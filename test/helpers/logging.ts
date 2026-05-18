import { type LogRecord, reset, type Sink } from "@logtape/logtape";

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

export async function resetLogTape(): Promise<void> {
  await reset();
}
