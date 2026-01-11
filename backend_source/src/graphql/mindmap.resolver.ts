import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { NodesService } from '../mindmap/nodes/nodes.service';
import { RelationshipsService } from '../mindmap/relationships/relationships.service';

@Resolver()
export class MindmapResolver {
  constructor(
    private nodesService: NodesService,
    private relService: RelationshipsService,
  ) {}

  @Query() // This pulls data for the frontend
  async getFullMap() {
    // Logic to combine SQL (Names) and Cypher (Links)
    const nodes = await this.nodesService.findAllNodes();
    return { nodes };
  }

  @Mutation() // This changes data
  async addFamilyMember(@Args('name') name: string, @Args('parent') parent: string) {
    const node = await this.nodesService.createNode(name, '', { parent });
    await this.relService.createRelationship(parent, name, 'PARENT_OF');
    return node;
  }
}
