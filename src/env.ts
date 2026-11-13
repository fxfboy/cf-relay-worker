import type { Room } from "./room";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  /**
   * 单条收到的文本帧字节上限，十进制整数字符串。
   * 未设置时用代码默认值 33554432（32 MiB）。
   */
  MAX_MESSAGE_BYTES?: string;
}
