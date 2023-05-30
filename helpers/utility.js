const getAvatarName = (data) => {
  let { first_name, last_name } = data;
  const { full_name } = data;
  if (full_name) {
    first_name = full_name.split(' ')[0];
    last_name = full_name.split(' ')[1] || '';
  }
  return `${first_name.charAt(0)} ${last_name.charAt(0)}`;
};

const validateEmail = (email) => {
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

module.exports = {
  getAvatarName,
  validateEmail,
};
