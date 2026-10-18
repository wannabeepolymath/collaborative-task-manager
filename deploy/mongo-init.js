db = db.getSiblingDB("collaborative_todo");
db.createUser({user: "teamtasks", pwd: process.env.APP_DB_PASSWORD,
  roles: [{role: "readWrite", db: "collaborative_todo"}]});
