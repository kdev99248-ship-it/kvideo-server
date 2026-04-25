const stream = require("fs").createWriteStream("actors_m.json", { flags: "a" });
const data = JSON.parse(require("fs").readFileSync("actors.json", "utf-8"));
// ghi
stream.write(JSON.stringify(data) + "\n");