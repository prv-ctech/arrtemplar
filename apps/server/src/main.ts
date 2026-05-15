import { APP_NAME } from "@arrweeb-anime/shared";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.serverPort);

console.info(`${APP_NAME} API listening on http://localhost:${env.serverPort}`);
