module.exports = {
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  getContactsAsync: async () => ({ data: [] }),
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Emails: 'emails',
  },
};
