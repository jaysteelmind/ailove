/**
 * QdrantService - Vector Database Operations
 * 
 * Manages 768-dimensional embeddings for user profiles using Qdrant vector database.
 * Implements HNSW algorithm for sub-200ms similarity search.
 * 
 * Mathematical Foundation:
 * - Vector Space: ℝ^768 (OpenAI text-embedding-3-large dimensions)
 * - Similarity Metric: Cosine similarity
 * - Search Complexity: O(log n) average case with HNSW
 * 
 * Performance Targets:
 * - Collection creation: <100ms
 * - Vector upsert: <50ms per vector
 * - Similarity search (top-100): <200ms
 * - Batch operations: <500ms for 100 vectors
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../../config';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    userId: string;
    dimension?: string; // values, interests, communication, lifestyle, goals
    createdAt: string;
    updatedAt: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  payload: VectorPoint['payload'];
}

export interface CollectionInfo {
  name: string;
  vectorSize: number;
  distance: string;
  pointsCount: number;
}

export class QdrantService {
  private client: QdrantClient;
  private readonly collectionName = 'user_embeddings';
  private readonly vectorSize = 768; // OpenAI text-embedding-3-large
  private readonly distance = 'Cosine'; // Cosine similarity

  constructor() {
    this.client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
    });
  }

  /**
   * Initialize Qdrant collections
   * Creates the user_embeddings collection if it doesn't exist
   * 
   * Complexity: O(1) - Single API call
   * Target Latency: <100ms
   */
  async initialize(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        await this.createCollection();
      }
    } catch (error) {
      throw new Error(`Failed to initialize Qdrant: ${error}`);
    }
  }

  /**
   * Create user embeddings collection
   * 
   * Configuration:
   * - Vector size: 768 dimensions
   * - Distance metric: Cosine similarity
   * - HNSW parameters:
   *   - m: 16 (connections per layer)
   *   - ef_construct: 100 (construction search depth)
   * 
   * Complexity: O(1)
   * Target Latency: <100ms
   */
  private async createCollection(): Promise<void> {
    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: this.vectorSize,
        distance: this.distance,
      },
      optimizers_config: {
        indexing_threshold: 10000, // Start indexing after 10k vectors
      },
      hnsw_config: {
        m: 16, // Connections per layer (balance between speed and accuracy)
        ef_construct: 100, // Search depth during construction
      },
    });
  }

  /**
   * Upsert a single vector point
   * 
   * Complexity: O(log n) average with HNSW
   * Target Latency: <50ms
   */
  async upsertVector(point: VectorPoint): Promise<void> {
    if (point.vector.length !== this.vectorSize) {
      throw new Error(
        `Vector size mismatch: expected ${this.vectorSize}, got ${point.vector.length}`
      );
    }

    await this.client.upsert(this.collectionName, {
      points: [
        {
          id: point.id,
          vector: point.vector,
          payload: point.payload,
        },
      ],
    });
  }

  /**
   * Batch upsert multiple vectors
   * 
   * Complexity: O(k * log n) where k = batch size
   * Target Latency: <500ms for 100 vectors
   */
  async upsertVectorBatch(points: VectorPoint[]): Promise<void> {
    // Validate all vectors
    for (const point of points) {
      if (point.vector.length !== this.vectorSize) {
        throw new Error(
          `Vector size mismatch for ${point.id}: expected ${this.vectorSize}, got ${point.vector.length}`
        );
      }
    }

    // Batch upsert in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize);
      await this.client.upsert(this.collectionName, {
        points: chunk.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   * 
   * Algorithm: HNSW (Hierarchical Navigable Small World)
   * Complexity: O(log n) average case
   * Target Latency: <200ms for top-100 results
   * 
   * @param vector Query vector (768 dimensions)
   * @param limit Number of results to return (default: 100)
   * @param filter Optional payload filter
   */
  async searchSimilar(
    vector: number[],
    limit: number = 100,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (vector.length !== this.vectorSize) {
      throw new Error(
        `Vector size mismatch: expected ${this.vectorSize}, got ${vector.length}`
      );
    }

    const results = await this.client.search(this.collectionName, {
      vector,
      limit,
      filter,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      payload: r.payload as VectorPoint['payload'],
    }));
  }

  /**
   * Get a specific vector by ID
   * 
   * Complexity: O(1)
   * Target Latency: <50ms
   */
  async getVector(id: string): Promise<VectorPoint | null> {
    const points = await this.client.retrieve(this.collectionName, {
      ids: [id],
      with_payload: true,
      with_vector: true,
    });

    if (points.length === 0) {
      return null;
    }

    const point = points[0];
    return {
      id: point.id as string,
      vector: point.vector as number[],
      payload: point.payload as VectorPoint['payload'],
    };
  }

  /**
   * Delete a vector by ID
   * 
   * Complexity: O(log n)
   * Target Latency: <50ms
   */
  async deleteVector(id: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      points: [id],
    });
  }

  /**
   * Get collection information
   * 
   * Complexity: O(1)
   * Target Latency: <50ms
   */
  async getCollectionInfo(): Promise<CollectionInfo> {
    const info = await this.client.getCollection(this.collectionName);

    return {
      name: this.collectionName,
      vectorSize: this.vectorSize,
      distance: this.distance,
      pointsCount: info.points_count || 0,
    };
  }

  /**
   * Health check - verify Qdrant connection
   * 
   * Complexity: O(1)
   * Target Latency: <50ms
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all vectors (USE WITH CAUTION - for testing only)
   * 
   * Complexity: O(n)
   */
  async clearCollection(): Promise<void> {
    await this.client.deleteCollection(this.collectionName);
    await this.createCollection();
  }
}

export default QdrantService;
