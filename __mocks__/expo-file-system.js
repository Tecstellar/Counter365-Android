class MockFile {
  constructor(dir, name) {
    this.uri = `file:///mock_storage/${name}`;
    this.exists = false;
  }
  create() {
    this.exists = true;
  }
  write(data) {}
}

const Paths = {
  document: { uri: 'file:///mock_documents/' },
  cache: { uri: 'file:///mock_cache/' },
};

module.exports = {
  Paths,
  File: MockFile,
  Directory: class {},
};
