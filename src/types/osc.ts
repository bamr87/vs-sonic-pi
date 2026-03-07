export type OscArgument = string | number | Buffer | boolean;

export interface OscMessage {
  address: string;
  args: OscArgument[];
}

export type OscMessageHandler = (msg: OscMessage) => void;

export interface MultiMessage {
  jobId: number;
  threadName: string;
  runtime: string;
  messages: Array<{ type: number; content: string }>;
}

export interface ServerError {
  jobId: number;
  description: string;
  backtrace: string;
  line: number;
}

export interface SyntaxError {
  jobId: number;
  description: string;
  errorLine: string;
  line: number;
  lineS: string;
}
