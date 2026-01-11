import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  
  // Explicitly define the property so there is no confusion
  private readonly configService: ConfigService;

  constructor(
    @Inject(ConfigService) configService: ConfigService  // <--- FORCE INJECTION HERE
  ) {
    this.configService = configService; // <--- MANUAL ASSIGNMENT
    
    // Debug Log: Prove that it arrived
    if (!this.configService) {
      this.logger.error('CRITICAL: ConfigService was NOT injected in constructor!');
    } else {
      this.logger.log('Constructor: ConfigService injected successfully.');
    }
  }

  async onModuleInit() {
    this.logger.log('Initializing Database Connection...');

    // Double check before crashing
    if (!this.configService) {
      this.logger.error('CRITICAL: configService is missing in onModuleInit');
      return; 
    }

    this.pool = new Pool({
      user: this.configService.get<string>('DB_USER'),
      host: this.configService.get<string>('BACKEND_DB_HOST') || 'postgres',
      database: this.configService.get<string>('DB_NAME') || 'postgres',
      password: this.configService.get<string>('DB_PASSWORD'),
      port: 5432,
    });

    try {
      await this.pool.query('SELECT NOW()');
      this.logger.log('✅ Database Connection Successful');
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS mindmap_nodes (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await this.pool.query(createTableQuery);
      this.logger.log('✅ Table "mindmap_nodes" is ready.');

    } catch (e) {
      this.logger.error('❌ Database Connection Failed', e);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }
}
