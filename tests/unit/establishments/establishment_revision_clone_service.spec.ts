import { test } from '@japa/runner'

import EstablishmentRevisionCloneService from '#modules/establishments/services/establishment_revision_clone_service'

type Row = Record<string, unknown>
type Operation = { kind: 'read' | 'insert'; table: string; rows?: Row[] }

type CloneBatchMethods = {
  copyAttributeValues(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: never
  ): Promise<void>
  copySpecialDays(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: never
  ): Promise<void>
}

class FakeReadQuery implements PromiseLike<Row[]> {
  constructor(private readonly rows: Row[]) {}

  where(..._arguments: unknown[]) {
    return this
  }

  whereIn(..._arguments: unknown[]) {
    return this
  }

  orderBy(..._arguments: unknown[]) {
    return this
  }

  then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.rows).then(onfulfilled, onrejected)
  }
}

class FakeInsertQuery implements PromiseLike<unknown> {
  constructor(private readonly returningRows: Row[]) {}

  returning(_columns: string[]) {
    return Promise.resolve(this.returningRows)
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(undefined).then(onfulfilled, onrejected)
  }
}

class FakeClient {
  readonly operations: Operation[] = []

  constructor(private readonly sourceRows: Record<string, Row[]>) {}

  from(table: string) {
    this.operations.push({ kind: 'read', table })
    return new FakeReadQuery(this.sourceRows[table] ?? [])
  }

  table(table: string) {
    return {
      insert: (payload: Row | Row[]) => {
        const rows = Array.isArray(payload) ? payload : [payload]
        this.operations.push({ kind: 'insert', table, rows })
        return new FakeInsertQuery(this.returningRows(table, rows))
      },
    }
  }

  insertedRows(table: string): Row[] {
    return this.operations
      .filter((operation) => operation.kind === 'insert' && operation.table === table)
      .flatMap((operation) => operation.rows ?? [])
  }

  private returningRows(table: string, rows: Row[]): Row[] {
    if (table === 'establishment_revision_attribute_values') {
      return rows
        .map((row) => ({
          id: 10_000 + Number(row.attribute_definition_id),
          attribute_definition_id: row.attribute_definition_id,
        }))
        .reverse()
    }

    if (table === 'establishment_revision_special_days') {
      return rows
        .map((row, index) => ({
          id: 20_001 + index,
          date: row.date,
        }))
        .reverse()
    }

    return []
  }
}

const cloneService = Object.create(EstablishmentRevisionCloneService.prototype) as CloneBatchMethods

test.group('Establishment revision clone batches', () => {
  test('copies attribute values and options with a constant operation count', async ({
    assert,
  }) => {
    const small = attributeClient(1)
    const large = attributeClient(25)

    await cloneService.copyAttributeValues(1, 2, 7, small as never)
    await cloneService.copyAttributeValues(1, 2, 7, large as never)

    const operationShape = (client: FakeClient) =>
      client.operations.map(({ kind, table }) => `${kind}:${table}`)
    assert.deepEqual(operationShape(large), operationShape(small))
    assert.deepEqual(operationShape(large), [
      'read:establishment_revision_attribute_values',
      'read:establishment_revision_attribute_value_options',
      'insert:establishment_revision_attribute_values',
      'insert:establishment_revision_attribute_value_options',
    ])

    const copiedOptions = large.insertedRows('establishment_revision_attribute_value_options')
    assert.lengthOf(copiedOptions, 50)
    for (const option of copiedOptions) {
      assert.equal(
        Number(option.attribute_value_id),
        10_000 + Number(option.attribute_definition_id)
      )
    }
  })

  test('bounds special-hour inserts while preserving every interval mapping', async ({
    assert,
  }) => {
    const small = specialDayClient(1)
    const large = specialDayClient(20)
    const annualMaximum = specialDayClient(366, 24)

    await cloneService.copySpecialDays(1, 2, 7, small as never)
    await cloneService.copySpecialDays(1, 2, 7, large as never)
    await cloneService.copySpecialDays(1, 2, 7, annualMaximum as never)

    const operationShape = (client: FakeClient) =>
      client.operations.map(({ kind, table }) => `${kind}:${table}`)
    assert.deepEqual(operationShape(large), operationShape(small))
    assert.deepEqual(operationShape(large), [
      'read:establishment_revision_special_days',
      'read:establishment_revision_special_hours',
      'insert:establishment_revision_special_days',
      'insert:establishment_revision_special_hours',
    ])

    const copiedIntervals = large.insertedRows('establishment_revision_special_hours')
    assert.lengthOf(copiedIntervals, 40)
    for (const interval of copiedIntervals) {
      const sourceDay = Math.floor(Number(interval.sort_order) / 100)
      assert.equal(Number(interval.special_day_id), 20_000 + sourceDay)
      assert.equal(Number(interval.revision_id), 2)
    }

    const annualIntervalInserts = annualMaximum.operations.filter(
      (operation) =>
        operation.kind === 'insert' && operation.table === 'establishment_revision_special_hours'
    )
    assert.lengthOf(annualIntervalInserts, 9)
    assert.lengthOf(annualMaximum.insertedRows('establishment_revision_special_hours'), 366 * 24)
    for (const operation of annualIntervalInserts) {
      assert.isAtMost(operation.rows?.length ?? 0, 1_000)
    }
    for (const interval of annualMaximum.insertedRows('establishment_revision_special_hours')) {
      const sourceDay = Math.floor(Number(interval.sort_order) / 100)
      assert.equal(Number(interval.special_day_id), 20_000 + sourceDay)
    }
  })
})

function attributeClient(size: number): FakeClient {
  const values = Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    attribute_definition_id: 100 + index,
    value_text: null,
    value_boolean: null,
    value_integer: null,
    value_decimal: null,
    value_url: null,
  }))
  const options = values.flatMap((value, index) =>
    [1, 2].map((option) => ({
      id: index * 2 + option,
      attribute_value_id: value.id,
      attribute_definition_id: value.attribute_definition_id,
      attribute_option_id: index * 2 + option,
    }))
  )

  return new FakeClient({
    establishment_revision_attribute_values: values,
    establishment_revision_attribute_value_options: options,
  })
}

function specialDayClient(size: number, intervalsPerDay = 2): FakeClient {
  const days = Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    date: new Date(Date.UTC(2028, 0, index + 1)).toISOString().slice(0, 10),
    status: 'custom_hours',
    note: null,
  }))
  const intervals = days.flatMap((day) =>
    Array.from({ length: intervalsPerDay }, (_, intervalIndex) => ({
      id: (day.id - 1) * intervalsPerDay + intervalIndex + 1,
      special_day_id: day.id,
      opens_at: '09:00',
      closes_at: '17:00',
      spans_next_day: false,
      sort_order: day.id * 100 + intervalIndex,
    }))
  )

  return new FakeClient({
    establishment_revision_special_days: days,
    establishment_revision_special_hours: intervals,
  })
}
