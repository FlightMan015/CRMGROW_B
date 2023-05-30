const request = require('request-promise');
const { ENV_PATH } = require('../config/path');
require('dotenv').config({ path: ENV_PATH });
const api = require('../config/api');

const getAll = async () => {
  const auth = Buffer.from(api.REWARDFUL.API_KEY + ':').toString('base64');
  const affilate_id = 'd2374499-6cc2-41dc-9b4f-393f7be824fd';

  request({
    method: 'GET',
    uri: `https://api.getrewardful.com/v1/referrals?affiliate_id=${affilate_id}&limit=100`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    json: true,
  })
    .then((response) => {
      const visitors = response.data;
      console.log('visitors', visitors);
    })
    .catch((err) => {
      console.log('affiliate err', err.message);
    });
};

// const filterAffiliate = () => {
//   fs.createReadStream(file.path)
//     .pipe(csv())
//     .on('data', async (data) => {
//       contact_array.push(data);
//     })
//     .on('end', async () => {});
// };

// filterAffiliate();
getAll();
