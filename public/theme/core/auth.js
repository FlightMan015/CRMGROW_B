// let url = new URL(location.href);
// let params = Qs.parse(url.search.substr(1));
// let auth2;
// var applicationConfig = {
//   clientID: 'cf34076b-4bb2-4eef-8fdb-a7d7f2376095',
//   scopes: [
//     'openid',
//     'profile',
//     'offline_access',
//   ],
//   authority: "https://login.microsoftonline.com/common",
//   redirectUri: "https://app.crmgrow.com/social-oauth-callback/outlook"
// };
// let socialType = $('#social_type').val();


// function start() {
//   gapi.load('auth2', function() {
//     auth2 = gapi.auth2.init({
//       client_id: '411466708563-qovcq88r0ptbsb1o2jjlnms5qu57rdec.apps.googleusercontent.com',
//     });

//     $('#signinButton').click(function() {
//       auth2.grantOfflineAccess({
//         redirect_uri: 'https://app.crmgrow.com/social-oauth-callback/google',
//       });
//     });

//     if (socialType === 'google') {
//       $("#signinButton").click();
//     }
//   });
// }

// var userAgentApplication = new Msal.UserAgentApplication(applicationConfig.clientID, applicationConfig.authority, function (errorDes, token, error, tokenType, instance) {
//     // this callback is called after loginRedirect OR acquireTokenRedirect. It's not used with loginPopup,  acquireTokenPopup.
//     if (error) {
//         console.log(error + ": " + errorDes);
//     }
//     else
//         console.log("Token type = " + tokenType);

// }, {redirectUri: applicationConfig.redirectUri, responseType: 'token'})


// if (socialType === 'outlook') {
//   userAgentApplication.loginRedirect(applicationConfig.scopes);
// }
if (document.querySelector('#redirect')) {
  document.querySelector('#redirect').click();
}