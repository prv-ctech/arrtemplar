import { APP_NAME } from "@arrweeb-anime/shared";
import { app } from "./app";
import { env } from "./config/env";

app.listen(env.serverPort);

console.info(`${APP_NAME} API listening on http://localhost:${env.serverPort}`);
