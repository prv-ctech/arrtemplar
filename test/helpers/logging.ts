import { configure, type LogRecord, reset, type Sink, type TextFormatter } from "@logtape/logtape";
import {
  createRedactedSink,
  createRedactedTextFormatter,
} from "../../apps/server/src/logging/redaction";

export type LogBuffer = {
  records: LogRecord[];
  sink: Sink;
};

export function createLogBuffer(): LogBuffer {
  const records: LogRecord[] = [];

  return {
    records,
    sink: (record) => records.push(record),
  };
}

export type RedactedLogCapture = LogBuffer & {
  formattedOutput: string[];
};

export async function configureRedactedLogCapture(
  formatter: TextFormatter = defaultRedactedCaptureFormatter,
): Promise<RedactedLogCapture> {
  const { records, sink } = createLogBuffer();
  const formattedOutput: string[] = [];
  const redactedFormatter = createRedactedTextFormatter(formatter);

  await configure({
    sinks: {
      buffer: createRedactedSink((record) => {
        sink(record);
        formattedOutput.push(redactedFormatter(record));
      }),
    },
    loggers: [{ category: ["arrweeb"], sinks: ["buffer"] }],
  });

  return { records, sink, formattedOutput };
}

export async function resetLogTape(): Promise<void> {
  await reset();
}

function defaultRedactedCaptureFormatter(record: LogRecord): string {
  return `${record.message.join("")} ${JSON.stringify(record.properties)}`;
}
