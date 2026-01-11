import { Module } from '@nestjs/common';
import { MindmapController } from './mindmap.controller';
import { MindmapService } from './mindmap.service';
import { DatabaseModule } from '../database/database.module'; // <--- Added this

@Module({
  imports: [DatabaseModule], // <--- ENSURES DatabaseService is available
  controllers: [MindmapController],
  providers: [MindmapService],
  exports: [MindmapService],
})
export class MindmapModule {}
