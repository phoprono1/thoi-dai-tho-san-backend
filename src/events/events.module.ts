/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Module, Global } from '@nestjs/common';
import { EventEmitter } from 'events';

export class EventsService {
  private emitter = new EventEmitter();

  emit(event: string | symbol, ...args: any[]) {
    this.emitter.emit(event as any, ...args);
  }

  on(event: string | symbol, listener: (...args: any[]) => void) {
    this.emitter.on(event as any, listener);
  }

  once(event: string | symbol, listener: (...args: any[]) => void) {
    this.emitter.once(event as any, listener);
  }

  off(event: string | symbol, listener: (...args: any[]) => void) {
    this.emitter.off(event as any, listener);
  }
}

@Global()
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
