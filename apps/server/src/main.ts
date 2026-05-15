import { app } from "./app";
import { env } from "./config/env";

app.listen(env.serverPort);

console.info(`AnimeHub API listening on http://localhost:${env.serverPort}`);
