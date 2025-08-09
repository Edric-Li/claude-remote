import { Repository, FindOptionsWhere, DeepPartial, FindManyOptions, ObjectLiteral } from 'typeorm'

export abstract class BaseRepository<T extends ObjectLiteral> {
  constructor(protected repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options)
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any })
  }

  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where })
  }

  async findMany(where: FindOptionsWhere<T>): Promise<T[]> {
    return this.repository.find({ where })
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data)
    return this.repository.save(entity)
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as any)
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id)
    return (result.affected ?? 0) > 0
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where })
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.count(where)
    return count > 0
  }
}