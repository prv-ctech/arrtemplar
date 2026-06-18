import { AsyncLocalStorage } from "node:async_hooks";
import { dirname } from "node:path";
import { getRotatingFileSink } from "@logtape/file";
import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
} from "@logtape/logtape";
import { resolveWorkspacePath } from "../config/database-paths";
import { env, type RuntimeEnv } from "../config/env";
import { createRedactedSink, createRedactedTextFormatter } from "./redaction";

export async function configureServerLogging(runtimeEnv: RuntimeEnv = env): Promise<void> {
  const logFilePath = resolveWorkspacePath(runtimeEnv.logFilePath);
  const appSinks = runtimeEnv.logConsoleEnabled
    ? (["appFile", "appConsole"] as const)
    : (["appFile"] as const);

  await ensureParentDirectory(logFilePath);
  await configure({
    contextLocalStorage: new AsyncLocalStorage(),
    filters: {
      runtimeLevel: runtimeEnv.logLevel,
      metaWarnings: "warning",
    },
    sinks: {
      appFile: createRedactedSink(
        getRotatingFileSink(logFilePath, {
          maxSize: runtimeEnv.logFileMaxSizeBytes,
          maxFiles: runtimeEnv.logFileMaxFiles,
          formatter: createRedactedTextFormatter(
            getJsonLinesFormatter({
              categorySeparator: ".",
              message: "rendered",
              properties: "nest:properties",
            }),
          ),
        }),
      ),
      appConsole: createRedactedSink(
        getConsoleSink({
          formatter: createRedactedTextFormatter(
            getAnsiColorFormatter({ timestamp: "date-time-tz" }),
          ),
        }),
      ),
      meta: createRedactedSink(
        getConsoleSink({
          formatter: createRedactedTextFormatter(
            getAnsiColorFormatter({ timestamp: "date-time-tz" }),
          ),
        }),
      ),
    },
    loggers: [
      {
        category: ["arrtemplar", "meta"],
        filters: ["metaWarnings"],
        sinks: ["meta"],
      },
      {
        category: ["arrtemplar"],
        filters: ["runtimeLevel"],
        sinks: [...appSinks],
      },
    ],
  });
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  const directory = dirname(filePath);

  if (directory === ".") {
    return;
  }

  const markerPath = `${directory}/.arrtemplar-log-dir`;

  await Bun.write(markerPath, "", { createPath: true });
  await Bun.file(markerPath).delete();
}
