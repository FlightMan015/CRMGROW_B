const app = require('../../../app');
const supertest = require('supertest');
const mongoose = require('mongoose');
const User = require('../../../models/user');

const { setupDB } = require('../../../test/test-setup');

// Setup a Test Database
setupDB('endpoint-testing');

// Continue with your tests...

const request = supertest(app);

const users = [
  {
    user_name: 'test1',
    email: 'testing1@gmail.com',
    password: 'password',
  },
  {
    user_name: 'test2',
    email: 'testing2@gmail.com',
    password: 'password',
  },
  {
    user_name: 'test3',
    email: 'testing3@gmail.com',
    password: 'password',
  },
];
// Seed the database with users
beforeEach(async () => {
  for (const u of users) {
    const user = new User(u);
    await user.save();
  }

  jest.setTimeout(100000);
});

describe('User SignUp', () => {
  it('should send message User already exist', async () => {
    const req = {
      user_name: 'user_name',
      email: 'testing1@gmail.com',
      cell_phone: '201-555-2033',
      password: 'password',
    };
    const res = await request.post('/api/user').send(req);
    expect(res.statusCode).toEqual(400);
    expect(res.body.status).toEqual(false);
    expect(res.body.error).toEqual('User already exists');
  });

  //   it('should save user and return data', async () => {
  //     const req = {
  //       user_name: 'Admin',
  //       email: 'elitelondonyouthleague@gmail.com',
  //       password: 'password',
  //       cell_phone: '+1 201-555-5555',
  //       phone: {
  //         number: '201-555-5555',
  //         internationalNumber: '+1 201-555-5555',
  //         nationalNumber: '(201) 555-5555',
  //         e164Number: '+12015555555',
  //         countryCode: 'US',
  //         dialCode: '+1',
  //       },
  //       time_zone_info:
  //         '{\n  "country": "US",\n  "name": "CDT (Central Daylight Time: UTC -05)",\n  "zone": "-05:00",\n  "tz_name": "America/Chicago",\n  "standard": "-06:00",\n  "daylight": "-05:00"\n}',
  //       token: {
  //         id: 'tok_1IoULUHtGFAPJAKZ20JFqZa8',
  //         object: 'token',
  //         card: {
  //           id: 'card_1IoULUHtGFAPJAKZEMm7RJJm',
  //           object: 'card',
  //           address_city: null,
  //           address_country: null,
  //           address_line1: null,
  //           address_line1_check: null,
  //           address_line2: null,
  //           address_state: null,
  //           address_zip: null,
  //           address_zip_check: null,
  //           brand: 'Visa',
  //           country: 'US',
  //           cvc_check: 'unchecked',
  //           dynamic_last4: null,
  //           exp_month: 4,
  //           exp_year: 2024,
  //           funding: 'credit',
  //           last4: '4242',
  //           name: null,
  //           tokenization_method: null,
  //         },
  //         client_ip: '188.43.235.177',
  //         created: 1620396480,
  //         livemode: false,
  //         type: 'card',
  //         used: false,
  //         card_name: 'Visa',
  //       },
  //     };

  //     const data = JSON.stringify(req);
  //     const res = await request.post('/api/user').send(req);

  //     console.log('res.body=', res.body);
  //     //expect(res.body.status).toEqual("200");
  //   });
});
