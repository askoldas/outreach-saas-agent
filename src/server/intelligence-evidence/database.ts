export type DatabaseError = { message: string };
export type DatabaseResponse = { data: unknown; error: DatabaseError | null };

export type DynamicQuery = PromiseLike<DatabaseResponse> & {
  select(columns?: string): DynamicQuery;
  insert(values: unknown): DynamicQuery;
  update(values: unknown): DynamicQuery;
  eq(column: string, value: unknown): DynamicQuery;
  order(column: string, options?: { ascending?: boolean }): DynamicQuery;
  single(): Promise<DatabaseResponse>;
};

export type DynamicDatabaseClient = {
  from(table: string): DynamicQuery;
  rpc(
    functionName: string,
    arguments_: Record<string, unknown>,
  ): Promise<DatabaseResponse>;
};
