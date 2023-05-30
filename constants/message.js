const messages = {
  USER: {
    ACCOUNT_NOT_EXIST: 'Account does not exist.',
    ACCOUNT_IN_REVIEW: 'Your account is under our review.',
    EMAIL_IN_USE: 'The email address you entered is already in use.',
    PASSWORD_IS_CORRECT: 'Password is not correct.',
    INCORRECT_PASSWORD: 'Incorrect password.',
    VERIFY_SENT:
      'We sent you a verification code. Please check your email. Code will expire in {{value}} mins.',
    VERIFY_CANT_FIND_EMAIL:
      "We can't find account with provided email address.",
    INCORRECT_VERIFY_CODE:
      'Incorrect verification code. Please check your email and try again.',
    VERIFY_CODE_EXPIRED: 'Your code has been expired.',
    VERIFY_CODE_MATCHED: 'Your code has been verified to reset password.',
    RESET_NEW_PASSWORD_COMPLETED: 'We have reset new password.',
    CHANGE_PASSWORD_COMPLETED: 'We had changed password.',
    PASSWORD_NOT_CORRECT: 'Current Password is not correct.',
  },
  ZOOM: {
    NO_ACCOUNT: 'No zoom account connected',
    TOKEN_EXPIRED: 'Access token expired',
  },
};
module.exports = messages;
