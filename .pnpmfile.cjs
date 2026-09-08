// PostgreSQL is the deployed database. Knex's optional SQLite peer otherwise
// promotes our explicit devDependency into pnpm's production dependency graph.
// Keep the driver available at the application root for local SQLite tooling.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'knex') {
        delete pkg.peerDependencies?.['better-sqlite3']
        delete pkg.peerDependenciesMeta?.['better-sqlite3']
      }
      return pkg
    },
  },
}
