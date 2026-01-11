import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NodesService {
  constructor(private readonly db: DatabaseService) {}

  async createPerson(name: string, bio: string, metadata: any) {
    const sql = `
      INSERT INTO mindmap_nodes (name, description, metadata)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    // We convert the metadata object to a string for Postgres JSONB
    const result = await this.db.query(sql, [name, bio, JSON.stringify(metadata)]);
    return result.rows[0];
  }
}
