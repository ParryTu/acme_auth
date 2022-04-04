const Sequelize = require("sequelize");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { user } = require("pg/lib/defaults");
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

const Note = conn.define("note", {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    let verifiedToken = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(verifiedToken.userId);
    if (user) {
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  let hashedPass = await bcrypt.hash(password, 10);
  const user = await User.findOne({
    where: {
      username,
    },
  });
  let correct = await bcrypt.compare(password, hashedPass);
  if (correct) {
    return jwt.sign({ userId: user.id }, process.env.JWT);
  }
  console.log("hasedPass: " + hashedPass);
  console.log("user.password: " + user.password);
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

User.beforeCreate(async (user) => {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
});

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const notes = [{ text: "note1" }, { text: "note2" }, { text: "note3" }];
  const [n1, n2, n3] = await Promise.all(notes.map((x) => Note.create(x)));

  await n1.setUser(lucy);
  await n2.setUser(moe);
  await n3.setUser(larry);

  console.log("seeding worked!!");
  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      n1,
      n2,
      n3,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
