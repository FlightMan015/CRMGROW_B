const request = require('request-promise');
const jwt = require('jsonwebtoken');

const VENDOR_ID = 'k8d8BvqFWV9rSTwZyGed64Dc0SbjSQ6D';
const API_KEY =
  'q6Oggy7to8EEgSyJTwvinjslHitdRjuC76UEtw8kxyGRDAlF1ogg3hc4WzW2vnzc';

const requestAuth = () => {
  const body = {
    id: '6093186f77897f7d47830ba6',
    email: 'ethan@wavv.com',
    firstName: 'Ethan',
    lastName: 'Galloway',
    phone: '5303562015',
    subscriptions: {
      multi: true,
      sms: true,
    },
    test: true,
  };

  var options = {
    method: 'POST',
    url: 'https://app.stormapp.com/api/customers',
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      user: VENDOR_ID,
      password: API_KEY,
    },
    body,
    json: true,
  };

  request(options, function (error, response, data) {
    if (error) throw new Error(error);

    console.log(data);
  });
};

const getCallToken = (req, res) => {
  const signature =
    'q6Oggy7to8EEgSyJTwvinjslHitdRjuC76UEtw8kxyGRDAlF1ogg3hc4WzW2vnzc';
  const payload = {
    userId: '123456',
  };
  const issuer = 'k8d8BvqFWV9rSTwZyGed64Dc0SbjSQ6D';
  const token = jwt.sign(payload, signature, { issuer, expiresIn: 3600 });
  console.log('token', token);
};

// requestAuth();
getCallToken();
