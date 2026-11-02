export function generateSchemaSql(definition) {
  if (!definition || typeof definition !== 'object' || !definition.tables) {
    throw new TypeError('schema.js must export a definition with a tables object');
  }

  return Object.entries(definition.tables).map(([name, table]) => {
    const columns = Object.entries(table.columns).map(([column, spec]) => {
      const constraints = [
        spec.primaryKey && 'PRIMARY KEY',
        spec.unique && 'UNIQUE',
        spec.notNull && 'NOT NULL',
        spec.default && `DEFAULT ${spec.default}`,
        spec.check && `CHECK (${spec.check})`,
        spec.references && `REFERENCES ${spec.references}`,
      ].filter(Boolean);
      return `  ${column} ${spec.type}${constraints.length ? ` ${constraints.join(' ')}` : ''}`;
    });
    if (table.primaryKey) columns.push(`  PRIMARY KEY (${table.primaryKey.join(', ')})`);
    return `CREATE TABLE IF NOT EXISTS ${name} (\n${columns.join(',\n')}\n);`;
  }).join('\n\n') + '\n';
}
