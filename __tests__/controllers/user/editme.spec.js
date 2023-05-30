const app = require('../../../app');
const supertest = require('supertest');
const mongoose = require('mongoose');
const User = require('../../../models/user');
const jsonwebtoken = require('jsonwebtoken');

const { setupDB } = require('../../../test/test-setup');

// Setup a Test Database
setupDB('test');
// Continue with your tests...

const request = supertest(app);
const auth = {};

const users = [
  {
    user_name: 'test1',
    email: 'testing1@gmail.com',
    salt: '2c0865035e40ff89e06a80dac2180d8a',
    hash: '35b026d02c1e396c222da865892f58007f88c0f8e813f86b42db1485076d9912a9611f30dd3ee51108bd3132939e8934853d33d0366581f831969e930337b846c66beae5f92c3bfe4271e54ac0decc0a324d280285ffc9e9463da51f9b712b963ef848c5262e39a61dc935ad0da6bf5f13f21369328cb263aec1f08e5c139f95c080c4084978752af3676663708ac892199cad77060ac9d541ce9e33fcc9b8c7afcfaa47826295a12a707d54cedd4aa8ea075b588ded62ea1a4441d0c113acaa8abb8a4e3a3fab0ff633a75be40912bd9b7cf8a80be826af53a9558522c9c27d8d338ec4460a338127ac4cc37786bb2595f168ee7400a625d445b4eadf43ddc0c106e6d6c791a4b2694fe22a93fc3a3f771fc97e4257db260e17771ea7b9f387a686d8d4d35b2a46d212b8e7790bfa4c1516db1279435b3b961b77ef3513a18a65a53b681b2eb96e7cf593e7a212b08776de81bf7689e15851a66cc9bfaa8f61a578482474a8837721e37e8722bc724b58ccb6cb9f51a2fa339b9ca7503f1f6e7a7c55d140daa07e81f5f4152f3fee929b722e7ca88c421a06ece6cebe86816b3f4e491fcb38220ff7c5316bee0186b15849a8753bfeb6a45ca4a603d533752ad838d5ac1130d0cb23f4fca7b3a88e8e789e48db453ff570360dc73da867590bade75802770d63d864eee55603db3de1b805f0aaac6e8eca5e17a15ef4e9ede1',
  },
];
// Seed the database with users
beforeEach(async () => {
  for (const u of users) {
    const user = new User(u);
    await user.save();
  }
  const req = {
    email: 'testing1@gmail.com',
    password: 'password',
  };
  const res = await request.post('/api/user/login').send(req);
  auth.token = res.body.data.token;
});

describe('User Editme', () => {
  it('Should update users data', async () => {
    const req = {
      user_name: 'Lee Weis',
      email: 'swiftdev2017@outlook.coms',
      phone: {
        number: '201-555-2033',
        internationalNumber: '+1 201-555-2033',
        nationalNumber: '(201) 555-2033',
        e164Number: '+12015552033',
        countryCode: 'US',
        dialCode: '+1',
      },
      company: 'eXp Realty',
      learn_more: 'dasd',
      time_zone_info:
        '{\n  "country": "US",\n  "name": "EDT (Eastern Daylight Time: UTC -04)",\n  "zone": "-04:00",\n  "tz_name": "America/New_York",\n  "standard": "-05:00",\n  "daylight": "-04:00"\n}',
      location: 'dsad',
    };

    const res = await request
      .put('/api/user/me')
      .send(req)
      .set('authorization', auth.token);
    expect(res.body.status).toEqual(true);
    expect(res.body.data).toBeDefined();
  });
  it('Should send error because request field is not match', async () => {
    const req = {
      user_name: 'Lee Weis',
      email: 'swiftdev2017@outlook.coms',
      phone: {
        number: '201-555-2033',
        internationalNumber: '+1 201-555-2033',
        nationalNumber: '(201) 555-2033',
        e164Number: '+12015552033',
        countryCode: 'US',
        dialCode: '+1',
      },
      company: 'eXp Realty',
      learn_more: ['learn', 'more'],
      time_zone_info:
        '{\n  "country": "US",\n  "name": "EDT (Eastern Daylight Time: UTC -04)",\n  "zone": "-04:00",\n  "tz_name": "America/New_York",\n  "standard": "-05:00",\n  "daylight": "-04:00"\n}',
      location: ['location1', 'location2'],
    };

    const res = await request
      .put('/api/user/me')
      .send(req)
      .set('authorization', auth.token);
    expect(res.statusCode).toBe(500);
    expect(res.body.status).toBe(false);
    expect(res.body.error).toBeDefined();
  });
});
