import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';

@Injectable()
export class RelationshipsService {
  constructor(private readonly neo4jService: Neo4jService) {}

  // This is the Cypher logic to link two family members
  async linkFamily(parentName: string, childName: string) {
    const cypher = `
      MERGE (p:Person {name: $parentName})
      MERGE (c:Person {name: $childName})
      CREATE (p)-[r:PARENT_OF]->(c)
      RETURN r
    `;
    
    return this.neo4jService.write(cypher, { parentName, childName });
  }
}
