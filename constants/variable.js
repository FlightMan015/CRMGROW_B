const time_zone = {
  '-04:00': 'America/Anguilla',
  '-05:00': 'America/Cancun',
  '-06:00': 'America/Belize',
  '-07:00': 'America/Phoenix',
  '-08:00': 'America/Los_Angeles',
  '-09:00': 'America/Anchorage',
  '-10:00': 'America/Atka',
};

const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const country_state = [
  {
    name: 'US',
    state: {
      AL: 'Alabama',
      AK: 'Alaska',
      AS: 'American Samoa',
      AZ: 'Arizona',
      AR: 'Arkansas',
      CA: 'California',
      CO: 'Colorado',
      CT: 'Connecticut',
      DE: 'Delaware',
      DC: 'District Of Columbia',
      FM: 'Federated States Of Micronesia',
      FL: 'Florida',
      GA: 'Georgia',
      GU: 'Guam',
      HI: 'Hawaii',
      ID: 'Idaho',
      IL: 'Illinois',
      IN: 'Indiana',
      IA: 'Iowa',
      KS: 'Kansas',
      KY: 'Kentucky',
      LA: 'Louisiana',
      ME: 'Maine',
      MH: 'Marshall Islands',
      MD: 'Maryland',
      MA: 'Massachusetts',
      MI: 'Michigan',
      MN: 'Minnesota',
      MS: 'Mississippi',
      MO: 'Missouri',
      MT: 'Montana',
      NE: 'Nebraska',
      NV: 'Nevada',
      NH: 'New Hampshire',
      NJ: 'New Jersey',
      NM: 'New Mexico',
      NY: 'New York',
      NC: 'North Carolina',
      ND: 'North Dakota',
      MP: 'Northern Mariana Islands',
      OH: 'Ohio',
      OK: 'Oklahoma',
      OR: 'Oregon',
      PW: 'Palau',
      PA: 'Pennsylvania',
      PR: 'Puerto Rico',
      RI: 'Rhode Island',
      SC: 'South Carolina',
      SD: 'South Dakota',
      TN: 'Tennessee',
      TX: 'Texas',
      UT: 'Utah',
      VT: 'Vermont',
      VI: 'Virgin Islands',
      VA: 'Virginia',
      WA: 'Washington',
      WV: 'West Virginia',
      WI: 'Wisconsin',
      WY: 'Wyoming',
    },
  },
  {
    name: 'CA',
    state: {
      AB: 'Alberta',
      BC: 'British Columbia',
      MB: 'Manitoba',
      NB: 'New Brunswick',
      NF: 'Newfoundland',
      NT: 'Northwest Territories',
      NS: 'Nova Scotia',
      NU: 'Nunavut',
      ON: 'Ontario',
      PE: 'Prince Edward Island',
      PQ: 'Quebec',
      SK: 'Saskatchewan',
      YT: 'Yukon',
    },
  },
  {
    name: 'AU',
    state: {
      NSW: 'New South Wales',
      VIC: 'Victoria',
      QLD: 'Queensland',
      TAS: 'Tasmania',
      SA: 'South Australia',
      WA: 'Western Australia',
      NT: 'Northern Territory',
      ACT: 'Australian Capital Territory',
    },
  },
  {
    name: 'DE',
    state: {
      BW: 'Baden-Württemberg',
      BY: 'Bavaria',
      BE: 'Berlin',
      BB: 'Brandenburg',
      HB: 'Bremen',
      HH: 'Hamburg',
      HE: 'Hesse',
      NI: 'Lower Saxony',
      MV: 'Mecklenburg-Vorpommern',
      NW: 'North Rhine-Westphalia',
      RP: 'Rhineland-Palatinate',
      SL: 'Saarland',
      SN: 'Saxony',
      ST: 'Saxony-Anhalt',
      SH: 'Schleswig-Holstein',
      TH: 'Thuringia',
    },
  },
  {
    name: 'IN',
    state: {
      AP: 'Andhra Pradesh',
      AR: 'Arunachal Pradesh',
      AS: 'Assam',
      BR: 'Bihar',
      CT: 'Chhattisgarh',
      GA: 'Goa',
      GJ: 'Gujarat',
      HR: 'Haryana',
      HP: 'Himachal Pradesh',
      JH: 'Jharkhand',
      KA: 'Karnataka',
      KL: 'Kerala',
      MP: 'Madhya Pradesh',
      MH: 'Maharashtra',
      MN: 'Manipur',
      ML: 'Meghalaya',
      MZ: 'Mizoram',
      NL: 'Nagaland',
      OR: 'Odisha',
      PB: 'Punjab',
      RJ: 'Rajasthan',
      SK: 'Sikkim',
      TN: 'Tamil Nadu',
      TG: 'Telangana',
      TR: 'Tripura',
      UP: 'Uttar Pradesh',
      UT: 'Uttarakhand',
      WB: 'West Bengal',
    },
  },
  {
    name: 'MX',
    state: {
      AG: 'Aguascalientes',
      BC: 'Baja California',
      BS: 'Baja California Sur',
      CH: 'Chihuahua',
      CL: 'Colima',
      CM: 'Campeche',
      CO: 'Coahuila',
      CS: 'Chiapas',
      DF: 'Federal District',
      DG: 'Durango',
      GR: 'Guerrero',
      GT: 'Guanajuato',
      HG: 'Hidalgo',
      JA: 'Jalisco',
      ME: 'México State',
      MI: 'Michoacán',
      MO: 'Morelos',
      NA: 'Nayarit',
      NL: 'Nuevo León',
      OA: 'Oaxaca',
      PB: 'Puebla',
      QE: 'Querétaro',
      QR: 'Quintana Roo',
      SI: 'Sinaloa',
      SL: 'San Luis Potosí',
      SO: 'Sonora',
      TB: 'Tabasco',
      TL: 'Tlaxcala',
      TM: 'Tamaulipas',
      VE: 'Veracruz',
      YU: 'Yucatán',
      ZA: 'Zacatecas',
    },
  },
  {
    name: 'ZA',
    state: {
      EC: 'Eastern Cape',
      FS: 'Free State',
      GT: 'Gauteng',
      NL: 'KwaZulu-Natal',
      LP: 'Limpopo',
      MP: 'Mpumalanga',
      NC: 'Northern Cape',
      NW: 'North West',
      WC: 'Western Cape',
    },
  },
  {
    name: 'UK',
    state: {
      ENGLAND: 'England',
      'NORTHERN IRELAND': 'Northern Ireland',
      SCOTLAND: 'Scotland',
      WALES: 'Wales',
    },
  },
];

var country = {};

const country_state1 = [];

const countries = require('country-state-city').Country;
const countryStates = require('country-state-city').State;

const all_countries = countries.getAllCountries();

const country_codes = () => {
  for (let i = 0; i < all_countries.length; i++) {
    country[all_countries[i].name] = all_countries[i].isoCode;
    // const state = {};
    // state['name'] = all_countries[i].isoCode;
    // const tempStates = countryStates.getStatesOfCountry(
    //   all_countries[i].isoCode
    // );
    // const statelists = {};

    // if (tempStates && tempStates.length > 0) {
    //   for (let j = 0; j < tempStates.length; j++) {
    //     statelists[tempStates[j].isoCode] = tempStates[j].name;
    //   }
    // }

    // state['state'] = { ...statelists };
    // country_state1.push(state);
  }
};

module.exports.time_zone = time_zone;
module.exports.days = days;
module.exports.country_codes = country_codes;
module.exports.CountryState = country_state;
module.exports.Countries = country;
