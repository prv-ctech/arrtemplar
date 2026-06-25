import { AsyncLocalStorage } from "node:async_hooks";
import {
  configure,
  dispose,
  type LogRecord,
  reset,
  type Sink,
  type TextFormatter,
} from "@logtape/logtape";
import { createLogRecorder, type LogRecorder } from "@logtape/testing";
import {
  createRedactedSink,
  createRedactedTextFormatter,
} from "../../apps/server/src/logging/redaction";
import { APP_LOG_CATEGORY } from "../../packages/shared/src";

export type LogBuffer = {
  recorder: LogRecorder;
  records: LogRecord[];
  sink: Sink;
};

export function createLogBuffer(): LogBuffer {
  const recorder = createLogRecorder();
  const records: LogRecord[] = [];

  return {
    recorder,
    records,
    sink: (record) => {
      recorder.sink(record);
      const recorded = recorder.records.at(-1);

      records.push(recorded ?? record);
    },
  };
}

export type RedactedLogCapture = LogBuffer & {
  formattedOutput: string[];
};

export async function configureRedactedLogCapture(
  formatter: TextFormatter = defaultRedactedCaptureFormatter,
): Promise<RedactedLogCapture> {
  const { recorder, records, sink } = createLogBuffer();
  const formattedOutput: string[] = [];
  const redactedFormatter = createRedactedTextFormatter(formatter);

  await configure({
    contextLocalStorage: new AsyncLocalStorage(),
    sinks: {
      buffer: createRedactedSink((record) => {
        sink(record);
        formattedOutput.push(redactedFormatter(record));
      }),
      meta: () => undefined,
    },
    loggers: [
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["meta"] },
      { category: [APP_LOG_CATEGORY], sinks: ["buffer"] },
    ],
  });

  return { recorder, records, sink, formattedOutput };
}

export async function resetLogTape(): Promise<void> {
  await dispose();
  await reset();
}

function defaultRedactedCaptureFormatter(record: LogRecord): string {
  return `${record.message.join("")} ${JSON.stringify(record.properties)}`;
}
