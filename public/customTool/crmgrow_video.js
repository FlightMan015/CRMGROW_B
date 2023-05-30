var PLAYER_PLACEHOLDER = 'https://ecsbe.crmgrow.com/theme/unlayer/player.gif';
var IMAGE_PLACEHOLDER = 'https://teamgrow.s3.us-east-2.amazonaws.com/profile120/4/5e923c70-a102-11ea-a0ee-81f2c01ef470.jpeg';
var MATERIAL_TITLE_PLACEHOLDER = 'CRMGrow Material Title would be here';
var MATERIAL_DESC_PLACEHOLDER = 'CRMGrow material description would be here. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras egestas ipsum sed diam egestas consectetur. Aenean vel turpis fermentum, suscipit justo eu, fermentum turpis. Praesent et lobortis lectus. Nunc felis leo, pulvinar eget neque sit amet, lacinia venenatis mi. Curabitur egestas sit amet felis vel cursus. Quisque interdum felis eros, et tristique tortor cursus at. Duis ultricies felis varius turpis bibendum egestas eget nec tellus. Cras ut sollicitudin nunc. Aenean non odio vel elit viverra tempor feugiat eu diam. Integer sagittis felis at leo sollicitudin cursus. Nam auctor facilisis tellus vel semper. Duis ut urna odio. CRMGrow material description would be here. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras egestas ipsum sed diam egestas consectetur. Aenean vel turpis fermentum, suscipit justo eu, fermentum turpis. Praesent et lobortis lectus. Nunc felis leo, pulvinar eget neque sit amet, lacinia venenatis mi. Curabitur egestas sit amet felis vel cursus. Quisque interdum felis eros, et tristique tortor cursus at. Duis ultricies felis varius turpis bibendum egestas eget nec tellus. Cras ut sollicitudin nunc. Aenean non odio vel elit viverra tempor feugiat eu diam. Integer sagittis felis at leo sollicitudin cursus. Nam auctor facilisis tellus vel semper. Duis ut urna odio.'
var ICONS = {
  FACEBOOK: '<svg aria-hidden="true" focusable="false" style="width: {{size}}px;" data-prefix="fab" data-icon="facebook-square" class="svg-inline--fa fa-facebook-square fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h137.25V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.27c-30.81 0-40.42 19.12-40.42 38.73V256h68.78l-11 71.69h-57.78V480H400a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48z"></path></svg>',
  LINKEDIN: '<svg aria-hidden="true" focusable="false" style="width: {{size}}px;" data-prefix="fab" data-icon="linkedin-in" class="svg-inline--fa fa-linkedin-in fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"></path></svg>',
  TWITTER: '<svg aria-hidden="true" focusable="false" style="width: {{size}}px;" data-prefix="fab" data-icon="twitter" class="svg-inline--fa fa-twitter fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"></path></svg>',
  PHONE1: 'https://ecsbe.crmgrow.com/theme/icons/phone.png',
  EMAIL1: 'https://ecsbe.crmgrow.com/theme/icons/envelope.png',
  PHONE: '<svg aria-hidden="true" focusable="false" style="width: {{size}}px;" data-prefix="fas" data-icon="phone-alt" class="svg-inline--fa fa-phone-alt fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M497.39 361.8l-112-48a24 24 0 0 0-28 6.9l-49.6 60.6A370.66 370.66 0 0 1 130.6 204.11l60.6-49.6a23.94 23.94 0 0 0 6.9-28l-48-112A24.16 24.16 0 0 0 122.6.61l-104 24A24 24 0 0 0 0 48c0 256.5 207.9 464 464 464a24 24 0 0 0 23.4-18.6l24-104a24.29 24.29 0 0 0-14.01-27.6z"></path></svg>',
  EMAIL: '<svg aria-hidden="true" focusable="false" style="width: {{size}}px;" data-prefix="fas" data-icon="envelope" class="svg-inline--fa fa-envelope fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M502.3 190.8c3.9-3.1 9.7-.2 9.7 4.7V400c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V195.6c0-5 5.7-7.8 9.7-4.7 22.4 17.4 52.1 39.5 154.1 113.6 21.1 15.4 56.7 47.8 92.2 47.6 35.7.3 72-32.8 92.3-47.6 102-74.1 131.6-96.3 154-113.7zM256 320c23.2.4 56.6-29.2 73.4-41.4 132.7-96.3 142.8-104.7 173.4-128.7 5.8-4.5 9.2-11.5 9.2-18.9v-19c0-26.5-21.5-48-48-48H48C21.5 64 0 85.5 0 112v19c0 7.4 3.4 14.3 9.2 18.9 30.6 23.9 40.7 32.4 173.4 128.7 16.8 12.2 50.2 41.8 73.4 41.4z"></path></svg>'
}
function getIcon(iconName, size) {
  let iconStr = ICONS[iconName];
  let icon = iconStr.replace('{{size}}', size);
  return icon
}
var MATERIAL_STYLES = {
  material_layout_4: `
    <style>
      .unlayer-material.material_layout_4 .unlayer-material-player {
        float: left;
        width: 60%;
        padding-right: 20px;
      }
      .unlayer-material.material_layout_4 .unlayer-material-title {
        float: left;
        width: 40%;
      }
      .unlayer-material.material_layout_4 .unlayer-material-description{
        padding-left: 15px;
      }
      .unlayer-material.material_layout_4 .unlayer-material::after {
        display: table;
        clear: both;
        content: '';
      }
    </style>
  `
}
var PROFILE_STYLES = {
  profile_layout_1: `
    <style>
      .up-layout1 .inner-container{
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        margin: auto;
      }
      .up-layout1 .inner-container .up-name-socials {
        margin-left: 16px;
      }
      .up-layout1 .inner-container .up-contacts {
        margin-left: auto;
        display: flex;
      }
      .up-phone-info {
        margin-right: 15px;
      }
      .up-layout1 .inner-container .up-contacts .icon {
        width: 20px;
        height: 20px;
        object-fit: contain;
        margin-right: 6px;
      }
      @media screen and (max-width: 760px) {
        .up-contacts {
          display: flex;
        }
      }
      @media screen and (max-width: 575px) {
        .up-contacts {
          width: 100%;
        }
        .up-contacts .up-email-info {
          margin-left: auto;
        }
      }
    </style>
  `,
  profile_layout_2: `
    <style>
      .up-layout2 {

      }
      .up-layout2 .up-avatar-user {
        display: flex;
        align-items: center;
      }
      .up-name-socials {
        margin-left: 10px;
      }
      .unlayer_user_learn {
        width: 100%;
        max-width: 300px;
        margin: auto;
        margin-top: 16px;
        text-decoration: none;
        display: block;
      }
    </style>
  `
}
var MATERIAL_LAYOUTS = [
  {
    name: 'Material Layout 1',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/layout1.png',
    id: 'material_layout_1'
  },
  {
    name: 'Material Layout 2',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/layout2.png',
    id: 'material_layout_2'
  },
  {
    name: 'Material Layout 3',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/layout3.png',
    id: 'material_layout_3'
  },
  {
    name: 'Material Layout 4',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/layout4.png',
    id: 'material_layout_4'
  },
];

var MATERIAL_LAYOUT_DETAIL = {
  material_layout_1: {
    fields: ['title', 'description', 'player'],
    style: [
      {type: 'slider', min: 16, max: 100, default: 16, label: 'Title Font', name: 'title_font'}
    ]
  },
  material_layout_2: {
    fields: ['title', 'description', 'player'],
    style: []
  },
  material_layout_3: {
    fields: ['title', 'description', 'player'],
    style: []
  },
  material_layout_4: {
    fields: ['title', 'description', 'player'],
    style: []
  },
};

var PROFILE_LAYOUTS = [
  {
    name: 'Profile Layout 1',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/profile_layout1.png',
    id: 'profile_layout_1'
  },
  {
    name: 'Profile Layout 2',
    image: 'https://ecsbe.crmgrow.com/theme/unlayer/profile_layout2.png',
    id: 'profile_layout_2'
  },
  // {
  //   name: 'Profile Layout 3',
  //   image: '',
  //   id: 'profile_layout_3'
  // },
  // {
  //   name: 'Profile Layout 4',
  //   image: '',
  //   id: 'profile_layout_4'
  // },
];
var PROFILE_LAYOUT_DETAIL = {
  profile_layout_1: {
    fields: ['avatar', 'user_name', 'phone', 'email', 'social', 'learn_more'],
    style: [
      {type: 'slider', min: 16, max: 100, default: 16, label: 'Title Font', name: 'title_font'}
    ]
  },
  profile_layout_2: {
    fields: ['avatar', 'user_name', 'phone', 'email', 'social'],
    style: []
  },
  profile_layout_3: {
    fields: ['avatar', 'user_name', 'phone', 'email', 'social'],
    style: []
  },
  profile_layout_4: {
    fields: ['avatar', 'user_name', 'phone', 'email', 'social'],
    style: []
  },
};

function getMaterialHTML(values) {
  let html = ''
  switch(values.materialField) {
    case 'player':
      html = `
        <div class="unlayer-material-player" style="
        ${values.playerMB ? 'margin-bottom:'+values.playerMB+'px' : ''};
        ">
          <img src="${PLAYER_PLACEHOLDER}" style="width: 100%;  background: white;"/>
        </div>
      `;
      break;
    case 'title':
      html = `
      <div style="
        color: ${values.titleColor}; 
        font-size: ${values.titleFontSize}px; 
        text-align: ${values.titleAlignment}; 
        font-family: ${values.titleFont ? values.titleFont.value : ''};
        ${values.titleMB ? 'margin-bottom:'+values.titleMB+'px' : ''};
      " class="unlayer-material-title">
        ${MATERIAL_TITLE_PLACEHOLDER}
      </div>
      `;
      break;
    case 'description':
      html = `
      <div style="
        color: ${values.descColor}; 
        text-align: ${values.descAlignment}; 
        font-family: ${values.descFont ? values.descFont.value: ''}; 
        font-size: ${values.descFontSize}px;
        ${values.descMB ? 'margin-bottom:'+values.descMB+'px' : ''};
      " class="unlayer-material-description">
        ${MATERIAL_DESC_PLACEHOLDER}
      </div>
      `;
      break;
    case 'block':
      const layout = values.materialLayout;
      const layoutHTML = {
        player: `
          <div class="unlayer-material-player" style="
            ${values.playerMB ? 'margin-bottom:'+values.playerMB+'px' : ''};
          ">
            <img src="${PLAYER_PLACEHOLDER}" style="width: 100%; background: white;"/>
          </div>
        `,
        title: `
          <div style="
            color: ${values.titleColor}; 
            font-size: ${values.titleFontSize}px; 
            text-align: ${values.titleAlignment}; 
            font-family: ${values.titleFont ? values.titleFont.value : ''};
            ${values.titleMB ? 'margin-bottom:'+values.titleMB+'px' : ''};
          " class="unlayer-material-title">
            ${MATERIAL_TITLE_PLACEHOLDER}
          </div>
        `,
        description: `
          <div style="
            color: ${values.descColor}; 
            text-align: ${values.descAlignment}; 
            font-family: ${values.descFont ? values.descFont.value: ''}; 
            font-size: ${values.descFontSize}px;
            ${values.descMB ? 'margin-bottom:'+values.descMB+'px' : ''};
          " class="unlayer-material-description">
            ${MATERIAL_DESC_PLACEHOLDER}
          </div>
        `
      };
      var hideFields = [];
      if( values.layoutFields ) { hideFields = values.layoutFields.split(','); }
      var fields = [];
      switch (layout) {
        case 'material_layout_1':
          fields = ['player', 'title', 'description'];
          break;
        case 'material_layout_2':
          fields = ['title', 'player', 'description'];
          break;
        case 'material_layout_3':
          fields = ['title', 'description', 'player'];
          break;
        case 'material_layout_4':
          fields = ['player', 'title', 'description'];
          break;
        default:
          fields = ['player', 'title', 'description'];
      }
      for ( let i = fields.length - 1; i >= 0 ; i--) {
        let e = fields[i];
        if (hideFields.indexOf(e) !== -1) {
          fields.splice(i, 1);
        }
      }
      fields.forEach(e => {
        html += layoutHTML[e];
      });
      html = `
        ${MATERIAL_STYLES[layout] ? MATERIAL_STYLES[layout] : ''}
        <div class='unlayer-material ${layout}' style="margin: auto; ${values.blockMax ? 'max-width:'+values.blockMax+'px;': ''}">
        ${html}  
        </div>
      `
  }
  return html;
}

function getProfileLayoutHTML(values) {
  var avatarHTML = `
    <div style="
      height: ${values.avatarSize}px; 
      width: ${values.avatarSize}px; 
      border-radius: ${values.avatarRadius}px; 
      box-shadow: ${values.avatarShadow}; 
      overflow: hidden;
      ${values.avatarMB ? 'margin-bottom:'+values.avatarMB+'px' : ''};
    ">
      <img src="${IMAGE_PLACEHOLDER}" style="width: 100%; height: 100%;"/ class="unlayer_user_avatar">
    </div>
  `;
  var nameHTML = `
    <div style="
      color: ${values.nameColor}; 
      font-size: ${values.nameFontSize}px; 
      text-align: ${values.nameAlignment}; 
      font-family: ${values.nameFont ? values.nameFont.value : ''};
      ${values.nameMT ? 'margin-top:'+values.nameMT+'px' : ''};
      ${values.nameMB ? 'margin-bottom:'+values.nameMB+'px' : ''};
    " class="unlayer_user_name">
      John Doe
    </div>
  `;
  var socialHTML = `
  <div class="unlayer_user_socials" style="
    text-align: ${values.socialAlignment};
    ${values.socialMT ? 'margin-top:'+values.socialMT+'px' : ''};
    ${values.socialMB ? 'margin-bottom:'+values.socialMB+'px' : ''};
  ">
    <a class="fb"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('FACEBOOK', values.socialFontSize)}</span></a>
    <a class="ln"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('LINKEDIN', values.socialFontSize)}</span></a>
    <a class="tw"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('TWITTER', values.socialFontSize)} </span></a>
  </div>
  `;
  var phoneHTML = ``;
  var emailHTML = ``;
  var learnMoreHTML = `
  <div>
    <a class="unlayer_user_learn" 
      style="
        padding: 8px 12px;
        background-color: ${values.learnBgColor};
        color: ${values.learnColor};
        font-size: ${values.learnFontSize}px;
        font-family: ${values.learnFont ? values.learnFont.value : ''};
        text-align: ${values.learnAlignment};
        border-radius: ${values.learnRadius}px;
        box-shadow: ${values.learnShadow};
        ${values.learnMT ? 'margin-top:'+values.learnMT+'px' : ''};
        ${values.learnMB ? 'margin-bottom:'+values.learnMB+'px' : ''};
      ">
      ${values.learnText}
    </a>
  </div>
  `;
  
  let html = '';
  let layout = values.profileLayout;
  var hideFields = [];
  if( values.layoutFields ) { hideFields = values.layoutFields.split(','); }
  var hideFieldStatus = {};
  hideFields.forEach(e => {
    hideFieldStatus[e] = true;
  });
  switch (layout) {
    case 'profile_layout_1':
      phoneHTML = `
        <div class="up-phone-info" style="
        ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
        ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
        ">
          <img class="icon" src="${ICONS['PHONE1']}" />
          <span style="
            color: ${values.contactColor}; 
            font-size: ${values.contactFontSize}px; 
            text-align: ${values.contactAlignment}; 
            font-family: ${values.contactFont ? values.contactFont.value : ''};
          "
            class="unlayer_user_phone"
          >
            (123) 456-7890
          </span>
        </div>
      `;
      emailHTML = `
        <div class="up-email-info" style="
          ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
          ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
        ">
          <img class="icon" src="${ICONS['EMAIL1']}" />
          <span style="
            color: ${values.contactColor}; 
            font-size: ${values.contactFontSize}px; 
            text-align: ${values.contactAlignment}; 
            font-family: ${values.contactFont ? values.contactFont.value : ''};
            " class="unlayer_user_email">
              john.doe@gmail.com
          </span>
        </div>
      `;
      html = `
        ${PROFILE_STYLES['profile_layout_1']}
        <div style="
          background-color: ${values.blockBackground}; 
          padding: ${values.blockPadding}px; 
          border-radius: ${values.blockRadius}px; 
          box-shadow: ${values.blockShadow};
          ${values.blockMax ? 'max-width:'+values.blockMax+'px;': ''}
          " 
          class="up-layout1">
          <div class="inner-container" style="margin: auto; ${values.blockInnerMax ? 'max-width:'+values.blockInnerMax+'px;': ''}">
            ${hideFieldStatus['avatar'] ? '' : avatarHTML}
            <div class="up-name-socials">
              ${hideFieldStatus['name'] ? '' : nameHTML}
              ${hideFieldStatus['social'] ? '' : socialHTML}
            </div>
            <div class="up-contacts">
              ${hideFieldStatus['phone'] ? '' : phoneHTML}
              ${hideFieldStatus['email'] ? '' : emailHTML}
            </div>
          </div>
        </div>
      `
      break;
    case 'profile_layout_2':
      phoneHTML = `
        <div class="up-phone-info"
          style="
            ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
            ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
          "
        >
          <span>${getIcon('PHONE', values.contactFontSize)}</span>
          <span style="
            color: ${values.contactColor}; 
            font-size: ${values.contactFontSize}px; 
            text-align: ${values.contactAlignment}; 
            font-family: ${values.contactFont ? values.contactFont.value : ''};"
            class="unlayer_user_phone"
          >
            (123) 456-7890
          </span>
        </div>
      `;
      emailHTML = `
        <div class="up-email-info" style="
          ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
          ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
        ">
          <span>${getIcon('EMAIL', values.contactFontSize)}</span>
          <span style="
            color: ${values.contactColor}; 
            font-size: ${values.contactFontSize}px; 
            text-align: ${values.contactAlignment}; 
            font-family: ${values.contactFont ? values.contactFont.value : ''};
            " class="unlayer_user_email">
              john.doe@gmail.com
          </span>
        </div>
      `;
      html = `
        ${PROFILE_STYLES['profile_layout_2']}
        <div style="
          background-color: ${values.blockBackground}; 
          padding: ${values.blockPadding}px; 
          border-radius: ${values.blockRadius}px; 
          box-shadow: ${values.blockShadow};
          ${values.blockMax ? 'max-width:'+values.blockMax+'px;': ''}" 
          class="up-layout2">
          <div class="inner-container" style="margin: auto; ${values.blockInnerMax ? 'max-width:'+values.blockInnerMax+'px;': ''}">
            <div class="up-avatar-user">
              ${hideFieldStatus['avatar'] ? '' : avatarHTML}
              <div class="up-name-socials">
                ${hideFieldStatus['name'] ? '' : nameHTML}
                ${hideFieldStatus['social'] ? '' : socialHTML}
              </div>
            </div>
            <div class="up-contact">
              ${hideFieldStatus['phone'] ? '' : phoneHTML}
              ${hideFieldStatus['email'] ? '' : emailHTML}
            </div>
            ${hideFieldStatus['learn_more'] ? '' : learnMoreHTML}
          </div>
        </div>
      `
      break;
    case 'profile_layout_3':
      html = `
        <div style="background-color: ${values.blockBackground}; padding: ${values.blockPadding}px; border-radius: ${values.blockRadius}px; box-shadow: ${values.blockShadow};" class="up-layout3">

        </div>
      `
      break;
    case 'profile_layout_4':
      html = `
        <div style="background-color: ${values.blockBackground}; padding: ${values.blockPadding}px; border-radius: ${values.blockRadius}px; box-shadow: ${values.blockShadow};" class="up-layout4">

        </div>
      `
      break;
  }
  return html;
  // return `<div>${JSON.stringify(layout)}, ${JSON.stringify(layoutFields)}</div>`
}

function getProfileHTML(values) {
  let html = ''
  switch(values.userField) {
    case 'profileBlock':
      html = getProfileLayoutHTML(values);
      break;
    case 'avatar':
      html = `
        <div style="
          height: ${values.avatarSize}px; 
          width: ${values.avatarSize}px; 
          border-radius: ${values.avatarRadius}px; 
          box-shadow: ${values.avatarShadow}; 
          overflow: hidden;
          ${values.avatarMB ? 'margin-bottom:'+values.avatarMB+'px' : ''};
        ">
          <img src="${IMAGE_PLACEHOLDER}" style="width: 100%; height: 100%;" class="unlayer_user_avatar"/>
        </div>
      `;
      break;
    case 'name':
      html = `
      <div style="
        color: ${values.nameColor}; 
        font-size: ${values.nameFontSize}px; 
        text-align: ${values.nameAlignment}; 
        font-family: ${values.nameFont ? values.nameFont.value : ''};
        ${values.nameMT ? 'margin-top:'+values.nameMT+'px' : ''};
        ${values.nameMB ? 'margin-bottom:'+values.nameMB+'px' : ''};
      " class="unlayer_user_name">
        John Doe
      </div>
      `;
      break;
    case 'phone':
      html = `
      <div style="
        color: ${values.contactColor}; 
        font-size: ${values.contactFontSize}px; 
        text-align: ${values.contactAlignment}; 
        font-family: ${values.contactFont ? values.contactFont.value : ''};"
        ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
        ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
        class="unlayer_user_phone"
      >
        (123) 456-7890
      </div>
      `;
      break;
    case 'email':
      html = `
      <div style="
        color: ${values.contactColor}; 
        font-size: ${values.contactFontSize}px; 
        text-align: ${values.contactAlignment}; 
        font-family: ${values.contactFont ? values.contactFont.value : ''};
        ${values.contactMT ? 'margin-top:'+values.contactMT+'px' : ''};
        ${values.contactMB ? 'margin-bottom:'+values.contactMB+'px' : ''};
        " class="unlayer_user_email">
        john.doe@gmail.com
      </div>
      `;
      break;
    case 'social':
      html = `
      <div 
        class="unlayer_user_socials" 
        style="
          text-align: ${values.socialAlignment};
          ${values.socialMT ? 'margin-top:'+values.socialMT+'px' : ''};
          ${values.socialMB ? 'margin-bottom:'+values.socialMB+'px' : ''};
        ">
        <a class="fb"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('FACEBOOK', values.socialFontSize)}</span></a>
        <a class="ln"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('LINKEDIN', values.socialFontSize)}</span></a>
        <a class="tw"><span style="color: ${values.socialColor}; font-size: ${values.socialFontSize}px;">${getIcon('TWITTER', values.socialFontSize)} </span></a>
      </div>
      `;
      break;
    case 'learn_more':
      html = `
        <div>
          <a class="unlayer_user_learn" 
            style="
              padding: 8px 12px;
              background-color: ${values.learnBgColor};
              color: ${values.learnColor};
              font-size: ${values.learnFontSize}px;
              font-family: ${values.learnFont ? values.learnFont.value : ''};
              text-align: ${values.learnAlignment};
              border-radius: ${values.learnRadius}px;
              box-shadow: ${values.learnShadow};
              ${values.learnMT ? 'margin-top:'+values.learnMT+'px' : ''};
              ${values.learnMB ? 'margin-bottom:'+values.learnMB+'px' : ''};
            ">
            ${values.learnText}
          </a>
        </div>
      `
    default:
      html = '';
  }
  return `
    <style>
      .unlayer_user_socials a {margin-right: 4px;}
    </style>
    ${html}
  `;
}

unlayer.registerPropertyEditor({
  name: 'material_content_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="block" name="material_field" value="block" class="material_field_type" ${value=='block' ? 'checked' : ''}>
        <label for="block">Material Block</label><br>
        <input type="radio" id="player" name="material_field" value="player" class="material_field_type" ${value=='player' ? 'checked' : ''}>
        <label for="player">Material Player</label><br>
        <input type="radio" id="title" name="material_field" value="title" class="material_field_type" ${value=='title' ? 'checked' : ''}>
        <label for="title">Material Title</label><br>
        <input type="radio" id="description" name="material_field" value="description" class="material_field_type" ${value=='description' ? 'checked' : ''}>
        <label for="description">Material Description</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'material_fields_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="checkbox" id="player_field" name="material_field_sel" value="player" class="show_material_field" ${value.indexOf('player') === -1 ? 'checked' : ''}>
        <label for="player_field">Material Player</label><br>
        <input type="checkbox" id="title_field" name="material_field_sel" value="title" class="show_material_field" ${value.indexOf('title') === -1 ? 'checked' : ''}>
        <label for="title_field">Material Title</label><br>
        <input type="checkbox" id="description_field" name="material_field_sel" value="description" class="show_material_field" ${value.indexOf('description') === -1 ? 'checked' : ''}>
        <label for="description_field">Material Description</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('show_material_field');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          const updatedValue = value || "";
          const fields = updatedValue.split(',');
          const field = event.target.value;
          const pos = fields.indexOf(field);
          if ( pos !== -1) {
            fields.splice(pos, 1);
          } else {
            fields.push(field);
          }
          updateValue(fields.join(','));
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'material_layout_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let html = ``;
      MATERIAL_LAYOUTS.forEach(e => {
        let layout =  `<input type="radio" id="${e.id}" name="material_layout" value="${e.id}" class="material_layout" ${value === e.id ? 'checked' : ''}>
        <label for="${e.id}">
          <img src="${e.image}" style="width: 100%;"/>
          <span>${e.name}</span>
        </label>
        <br>`;
        html += layout;
      })
      return `
        <style>
        input.material_layout {
          display: none;
        }
        input.material_layout:checked + label {
          border: 3px solid blue;
        }
        input.material_layout + label {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
        }
        input.material_layout + label img {
          width: 100%;
          min-height: 100px;
          object-fit: contain;
          background: #484848c7;          
        }
        input.material_layout + label span {
          position: absolute;
          bottom: 0px;
          z-index: 2;
          left: 0px;
          width: 100%;
          display: block;
          background: #00000059;
          padding: 10px;
          color: white;
          font-weight: bold;
        }
        </style>
        ${html}
      `;
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_layout')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'user_information_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="profileBlock" name="user_field" value="profileBlock" class="user_field_type" ${value=='profileBlock' ? 'checked' : ''}>
        <label for="profileBlock">User Block</label><br />
        <input type="radio" id="avatar" name="user_field" value="avatar" class="user_field_type" ${value=='avatar' ? 'checked' : ''}>
        <label for="avatar">User Photo</label><br />
        <input type="radio" id="name" name="user_field" value="name" class="user_field_type" ${value=='name' ? 'checked' : ''}>
        <label for="name">Username</label><br />
        <input type="radio" id="phone" name="user_field" value="phone" class="user_field_type" ${value=='phone' ? 'checked' : ''}>
        <label for="phone">User Phone number</label><br />
        <input type="radio" id="email" name="user_field" value="email" class="user_field_type" ${value=='email' ? 'checked' : ''}>
        <label for="email">User email</label><br />
        <input type="radio" id="social" name="user_field" value="social" class="user_field_type" ${value=='social' ? 'checked' : ''}>
        <label for="social">User Social Links</label><br />
        <input type="radio" id="learn" name="user_field" value="learn_more" class="user_field_type" ${value=='learn_more' ? 'checked' : ''}>
        <label for="social">Learn More</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('user_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'user_field_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="checkbox" id="avatar_field" name="user_field_sel" value="avatar" class="show_user_field" ${value.indexOf('avatar') === -1 ? 'checked' : ''}>
        <label for="avatar_field">User Photo</label><br />
        <input type="checkbox" id="name_field" name="user_field_sel" value="name" class="show_user_field" ${value.indexOf('name') === -1 ? 'checked' : ''}>
        <label for="name_field">Username</label><br />
        <input type="checkbox" id="phone_field" name="user_field_sel" value="phone" class="show_user_field" ${value.indexOf('phone') === -1 ? 'checked' : ''}>
        <label for="phone_field">User Phone number</label><br />
        <input type="checkbox" id="email_field" name="user_field_sel" value="email" class="show_user_field" ${value.indexOf('email') === -1 ? 'checked' : ''}>
        <label for="email_field">User email</label><br />
        <input type="checkbox" id="social_field" name="user_field_sel" value="social" class="show_user_field" ${value.indexOf('social') === -1 ? 'checked' : ''}>
        <label for="social_field">User Social Links</label><br />
        <input type="checkbox" id="learn_field" name="user_field_sel" value="learn_more" class="show_user_field" ${value.indexOf('learn_more') === -1 ? 'checked' : ''}>
        <label for="social_field">Learn More Links</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('show_user_field');
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          const updatedValue = value || "";
          const fields = updatedValue.split(',');
          const field = event.target.value;
          const pos = fields.indexOf(field);
          if ( pos !== -1) {
            fields.splice(pos, 1);
          } else {
            fields.push(field);
          }
          updateValue(fields.join(','));
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'profile_layout_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let html = ``;
      PROFILE_LAYOUTS.forEach(e => {
        let layout =  `<input type="radio" id="${e.id}" name="profile_layout" value="${e.id}" class="profile_layout" ${value === e.id ? 'checked' : ''}>
        <label for="${e.id}">
          <img src="${e.image}" style="width: 100%;"/>
          <span>${e.name}</span>
        </label><br>`;
        html += layout;
      })
      return `
        <style>
        input.profile_layout {
          display: none;
        }
        input.profile_layout:checked + label {
          border: 3px solid blue;
        }
        input.profile_layout + label {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
        }
        input.profile_layout + label img {
          width: 100%;
          min-height: 100px;
          object-fit: contain;
          background: #484848c7;          
        }
        input.profile_layout + label span {
          position: absolute;
          bottom: 0px;
          z-index: 2;
          left: 0px;
          width: 100%;
          display: block;
          background: #00000059;
          padding: 10px;
          color: white;
          font-weight: bold;
        }
        </style>
        ${html}
      `;
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('profile_layout')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'font_size_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <label for="font-size" style="font-size: 12px;
          color: rgb(143, 150, 153);
          font-weight: 600;">Font Size</label>
        <input type="number" id="font-size" value="${value}" defaultValue="16" class="font-size-input" style="float: right; width: 50px;"/>
      `
    },
    mount(node, value, updateValue, data) {
      var input = node.getElementsByClassName('font-size-input')[0];
      input.onchange = function(event) {
        updateValue(event.target.value);
      };
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'size_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      console.log('seize slector', data,value);
      return `
        <label for="font-size" style="font-size: 12px;
          color: rgb(143, 150, 153);
          font-weight: 600;">Avatar Size</label>
        <input type="number" id="avatar-size" value="${value}" defaultValue="60" class="avatar-size-input" style="float: right; width: 60px;"/>
      `
    },
    mount(node, value, updateValue, data) {
      var input = node.getElementsByClassName('avatar-size-input')[0];
      input.onchange = function(event) {
        updateValue(event.target.value);
      };
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'shadow_style_input',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let offset_x = 0;
      let offset_y = 0;
      let radius = 0;
      let spread = 0;
      let color = 0;
      let values = [];
      if( value ) {
        values = value.split(' ');
        offset_x = parseInt(values[0]);
        offset_y = parseInt(values[1]);
        radius = parseInt(values[2]);
        spread = parseInt(values[3]);
        color = values[4];
      }
      return `
        <label for="font-size" style="font-size: 13px;
          color: rgb(143, 150, 153);
          font-weight: 600;">Shadow Style</label>
        <div style="display: flex;">
          <label for="font-size" style="font-size: 12px;
            color: rgb(143, 150, 153);
            font-weight: 400;">Offset X</label>
          <input type="number" value="${offset_x}" defaultValue="0" id="shadow-offset-x" class="shadow-property" style="float: right; width: 50px; margin-left: auto;"/> 
        </div>
        <div style="display: flex;">
          <label for="font-size" style="font-size: 12px;
            color: rgb(143, 150, 153);
            font-weight: 400;">Offset Y</label>
          <input type="number" value="${offset_y}" defaultValue="0" id="shadow-offset-y" class="shadow-property" style="float: right; width: 50px; margin-left: auto;"/> 
        </div>
        <div style="display: flex;">
          <label for="font-size" style="font-size: 12px;
            color: rgb(143, 150, 153);
            font-weight: 400;">Radius</label>
          <input type="number" value="${radius}" defaultValue="10" id="shadow-radius" class="shadow-property" style="float: right; width: 50px; margin-left: auto;"/> 
        </div>
        <div style="display: flex;">
          <label for="font-size" style="font-size: 12px;
            color: rgb(143, 150, 153);
            font-weight: 400;">Spread</label>
          <input type="number" value="${spread}" defaultValue="0" id="shadow-spread" class="shadow-property" style="float: right; width: 50px; margin-left: auto;"/> 
        </div>
        <div style="display: flex;">
          <label for="font-size" style="font-size: 12px;
            color: rgb(143, 150, 153);
            font-weight: 400;">Color</label>
          <input type="color" value="${color}" defaultValue="#aaa" id="shadow-color" class="shadow-property" style="float: right; width: 50px; margin-left: auto;"/> 
        </div>
      `
    },
    mount(node, value, updateValue, data) {
      var properties = node.getElementsByClassName('shadow-property')
      for (var i = 0; i < properties.length; i++) {
        properties[i].addEventListener('change', function(event) {
          let offsetX = node.querySelector('#shadow-offset-x').value;
          let offsetY = node.querySelector('#shadow-offset-y').value;
          let shadowRadius = node.querySelector('#shadow-radius').value;
          let spread = node.querySelector('#shadow-spread').value;
          let color = node.querySelector('#shadow-color').value;
          let value = `${offsetX}px ${offsetY}px ${shadowRadius}px ${spread}px ${color}`;
          updateValue(value);
        });
      }
    }
  })
});

unlayer.registerTool({
    name: 'my_tool',
    label: 'CRM Material',
    icon: 'fa-photo-video',
    supportedDisplayModes: ['web', 'email'],
    options: {
      fields: {
        title: "Material Fields",
        position: 1,
        options: {
          "materialField": {
            "label": "Material Field",
            "defaultValue": "block",
            "widget": "material_content_selector"
          }
        }
      },
      layouts: {
        title: "Material Blocks",
        position: 2,
        options: {
          "materialLayout": {
            label: "Material Layout",
            defaultValue: "material_layout_1",
            widget: "material_layout_selector"
          },
          "layoutFields": {
            label: "Layout Contents",
            defaultValue: "",
            widget: "material_fields_selector"
          },
          "blockMax": {
            label: "Max Width",
            defaultValue: '1000',
            widget: 'counter'
          }
        }
      },
      playerStyle: {
        title: 'Player Style',
        position: 3,
        options: {
          playerMB: {
            label: 'Bottom Margin',
            defaultValue: '15',
            widget: 'counter'
          }
        }
      },
      titleStyle: {
        title: "Title Style",
        position: 3,
        options: {
          "titleAlignment": {
            "label": "Alignment",
            "defaultValue": "center",
            "widget": "alignment"
          },
          "titleColor": {
            "label": "Text Color",
            "defaultValue": "#000",
            "widget": "color_picker"
          },
          "titleFont": {
            label: "Font",
            "defaultValue": {
              label: 'Arial',
              value: 'arial,helvetica,sans-serif'
            },
            "widget": "font_family"
          },
          "titleFontSize": {
            label: "Font Size",
            defaultValue: 24,
            "widget": 'font_size_selector'
          },
          titleMB: {
            label: 'Bottom Margin',
            defaultValue: '15',
            widget: 'counter'
          }
        }
      },
      descStyle: {
        title: "Description Style",
        position: 4,
        options: {
          "descAlignment": {
            "label": "Alignment",
            "defaultValue": "left",
            "widget": "alignment"
          },
          "descColor": {
            "label": "Text Color",
            "defaultValue": "#000",
            "widget": "color_picker"
          },
          "descFont": {
            label: "Font",
            "defaultValue": {
              label: 'Arial',
              value: 'arial,helvetica,sans-serif'
            },
            "widget": "font_family"
          },
          "descFontSize": {
            label: "Font Size",
            defaultValue: 16,
            "widget": 'font_size_selector'
          },
          descMB: {
            label: 'Bottom Margin',
            defaultValue: '15',
            widget: 'counter'
          }
        }
      }
    },
    propertyStates: (values) => {
      let layoutStatus = true;
      let playerStyle = true;
      let titleStyle = true;
      let descriptionStyle = true;
      switch (values.materialField) {
        case 'block':
          layoutStatus = true;
          playerStyle = true;
          titleStyle = true;
          descriptionStyle = true;
          break;
        case 'player':
          layoutStatus = false;
          titleStyle = false;
          descriptionStyle = false;
          playerStyle = false;
          break;
        case 'title':
          layoutStatus = false;
          titleStyle = true;
          descriptionStyle = false;
          break;
        case 'description':
          layoutStatus = false;
          titleStyle = false;
          descriptionStyle = true;
          break;
      }
      return {
        materialLayout: {
          enabled: layoutStatus
        },
        layoutFields: {
          enabled: layoutStatus
        },
        blockMax: {
          enabled: layoutStatus
        },
        playerMB: {
          enabled: playerStyle
        },
        titleAlignment: {
          enabled: titleStyle
        },
        titleColor: {
          enabled: titleStyle
        },
        titleFont: {
          enabled: titleStyle
        },
        titleFontSize: {
          enabled: titleStyle
        },
        titleMB: {
          enabled: playerStyle
        },
        descAlignment: {
          enabled: descriptionStyle
        },
        descColor: {
          enabled: descriptionStyle
        },
        descFont: {
          enabled: descriptionStyle
        },
        descFontSize: {
          enabled: descriptionStyle
        },
        descMB: {
          enabled: playerStyle
        }
      }
    },
    values: {},
    renderer: {
      Viewer: unlayer.createViewer({
        render(values) {
          let html = getMaterialHTML(values);
          return html;
        }
      }),
      exporters: {
        web: function(values) {
          let html = getMaterialHTML(values);
          return html;
        },
        email: function(values) {
          let html = getMaterialHTML(values);
          return html;
        }
      },
      head: {
        css: function(values) {},
        js: function(values) {}
      }
    }
  });

unlayer.registerTool({
  name: 'crm_user',
  label: 'Your Information',
  icon: 'fa-user',
  supportedDisplayModes: ['web', 'email'],
  options: {
    fields: {
      title: "Your Information Fields",
      position: 1,
      options: {
        "userField": {
          "label": "Your Information",
          "defaultValue": "profileBlock",
          "widget": "user_information_selector"
        }
      }
    },
    layouts: {
      title: "Your Information Block Layout",
      position: 2,
      options: {
        "profileLayout": {
          label: "Profile Layout",
          defaultValue: "profile_layout_1",
          widget: "profile_layout_selector"
        },
        "layoutFields": {
          lable: "Layout Contents",
          defaultValue: "",
          widget: "user_field_selector"
        }
      }
    },
    blockStyle: {
      title: "Block Style",
      position: 2,
      options: {
        "blockMax": {
          label: 'Max Width',
          defaultValue: '1000',
          widget: 'counter'
        },
        "blockInnerMax": {
          label: 'Inner Max Width',
          defaultValue: '1000',
          widget: 'counter'
        },
        "blockPadding": {
          "label": "Inner Spacing(Padding)",
          "defaultValue": "15",
          "widget": "counter"
        },
        "blockRadius": {
          "label": "Block Radius",
          "defaultValue": "0",
          "widget": "counter"
        },
        "blockShadow": {
          "label": "Size",
          "defaultValue": "0px 0px 0px 0px #fff",
          "widget": "shadow_style_input"
        },
        "blockBackground": {
          "label": "Background Color",
          "defaultValue": "#fff",
          "widget": "color_picker"
        }
      }
    },
    avatarStyle: {
      title: "Avatar Style",
      position: 3,
      options: {
        "avatarSize": {
          "label": "Avatar Size",
          "defaultValue": "60",
          "widget": "counter"
        },
        "avatarRadius": {
          "label": "Avatar Radius",
          "defaultValue": "30",
          "widget": "counter"
        },
        "avatarShadow": {
          "label": "Size",
          "defaultValue": "0px 0px 0px 0px #fff",
          "widget": "shadow_style_input"
        },
        "avatarMB": {
          label: 'Margin Bottom',
          defaultValue: "0",
          widget: 'counter'
        }
      }
    },
    nameStyle: {
      title: "Name Style",
      position: 4,
      options: {
        "nameColor": {
          "label": "Text Color",
          "defaultValue": "#000",
          "widget": "color_picker"
        },
        "nameFont": {
          label: "Font",
          "defaultValue": {
            label: 'Arial',
            value: 'arial,helvetica,sans-serif'
          },
          "widget": "font_family"
        },
        "nameFontSize": {
          label: "Font Size",
          defaultValue: 20,
          "widget": 'font_size_selector'
        },
        "nameAlignment": {
          "label": "Alignment",
          "defaultValue": "center",
          "widget": "alignment"
        },
        "nameMT": {
          label: 'Margin Top',
          defaultValue: "0",
          widget: 'counter'
        },
        nameMB: {
          label: 'Margin Bottom',
          defaultValue: "0",
          widget: 'counter'
        }
      }
    },
    contactStyle: {
      title: "Contact Information Style(Email & Password)",
      position: 4,
      options: {
        "contactColor": {
          "label": "Text Color",
          "defaultValue": "#000",
          "widget": "color_picker"
        },
        "contactFont": {
          label: "Font",
          "defaultValue": {
            label: 'Arial',
            value: 'arial,helvetica,sans-serif'
          },
          "widget": "font_family"
        },
        "contactFontSize": {
          label: "Font Size",
          defaultValue: 16,
          "widget": 'font_size_selector'
        },
        "contactAlignment": {
          "label": "Alignment",
          "defaultValue": "center",
          "widget": "alignment"
        },
        contactMT: {
          label: 'Margin Top',
          defaultValue: "0",
          widget: 'counter'
        },
        contactMB: {
          label: 'Margin Bottom',
          defaultValue: "0",
          widget: 'counter'
        }
      }
    },
    socialStyle: {
      title: "Social Links Style",
      position: 4,
      options: {
        "socialColor": {
          "label": "Text Color",
          "defaultValue": "#000",
          "widget": "color_picker"
        },
        "socialFontSize": {
          label: "Font Size",
          defaultValue: 20,
          "widget": 'font_size_selector'
        },
        "socialAlignment": {
          "label": "Alignment",
          "defaultValue": "center",
          "widget": "alignment"
        },
        socialMT: {
          label: 'Margin Top',
          defaultValue: "0",
          widget: 'counter'
        },
        socialMB: {
          label: 'Margin Bottom',
          defaultValue: "0",
          widget: 'counter'
        }
      }
    },
    learnStyle: {
      title: 'Learn more Style',
      position: 6,
      options: {
        "learnText": {
          label: 'Link Text(If empty, it will be link)',
          'defaultValue': 'Learn More',
          'widget': 'text',
        },
        "learnBgColor": {
          "label": "Background Color",
          "defaultValue": "#e67e23",
          "widget": "color_picker"
        },
        "learnColor": {
          "label": "Text Color",
          "defaultValue": "#fff",
          "widget": "color_picker"
        },
        "learnFont": {
          label: "Font",
          "defaultValue": {
            label: 'Arial',
            value: 'arial,helvetica,sans-serif'
          },
          "widget": "font_family"
        },
        "learnFontSize": {
          label: "Font Size",
          defaultValue: 20,
          "widget": 'font_size_selector'
        },
        "learnAlignment": {
          "label": "Alignment",
          "defaultValue": "center",
          "widget": "alignment"
        },
        "learnRadius": {
          "label": "Radius",
          "defaultValue": "4",
          "widget": "counter"
        },
        "learnShadow": {
          "label": "Size",
          "defaultValue": "0px 0px 0px 0px #fff",
          "widget": "shadow_style_input"
        },
        learnMT: {
          label: 'Margin Top',
          defaultValue: "0",
          widget: 'counter'
        },
        learnMB: {
          label: 'Margin Bottom',
          defaultValue: "0",
          widget: 'counter'
        }
      }
    },
  },
  propertyStates: (values) => {
    let layoutStatus = false;
    let avatarStyle = false;
    let nameStyle = false;
    let contactStyle = false;
    let socialStyle = false;
    let learnStyle = false;
    switch (values.userField) {
      case 'profileBlock':
        layoutStatus = true;
        avatarStyle = true;
        nameStyle = true;
        contactStyle = true;
        socialStyle = true;
        learnStyle = true;
        break;
      case 'avatar':
        avatarStyle = true;
        break;
      case 'name':
        nameStyle = true;
        break;
      case 'phone':
        contactStyle = true;
        break;
      case 'email':
        contactStyle = true;
        break;
      case 'social':
        socialStyle = true;
        break;
      case 'learn_more':
        learnStyle = true;
        break;
    }
    return {
      profileLayout: {enabled: layoutStatus},
      layoutFields: {enabled: layoutStatus},
      blockMax: {enabled: layoutStatus},
      blockInnerMax: {enabled: layoutStatus},
      blockPadding: {enabled: layoutStatus},
      blockRadius: {enabled: layoutStatus},
      blockShadow: {enabled: layoutStatus},
      blockBackground: {enabled: layoutStatus},
      avatarSize: {enabled: avatarStyle},
      avatarRadius: {enabled: avatarStyle},
      avatarShadow: {enabled: avatarStyle},
      avatarMB: {enabled: avatarStyle},
      nameColor: {enabled: nameStyle},
      nameFont: {enabled: nameStyle},
      nameFontSize: {enabled: nameStyle},
      nameAlignment: {enabled: nameStyle},
      nameMT:  {enabled: nameStyle},
      nameMB:  {enabled: nameStyle},
      contactColor: {enabled: contactStyle},
      contactFont: {enabled: contactStyle},
      contactFontSize: {enabled: contactStyle},
      contactAlignment: {enabled: contactStyle},
      contactMT: {enabled: contactStyle},
      contactMB: {enabled: contactStyle},
      socialColor: {enabled: socialStyle},
      socialFontSize: {enabled: socialStyle},
      socialAlignment: {enabled: socialStyle},
      socialMT: {enabled: socialStyle},
      socialMB: {enabled: socialStyle},
      learnBgColor: {enabled: learnStyle},
      learnColor: {enabled: learnStyle},
      learnFont: {enabled: learnStyle},
      learnFontSize: {enabled: learnStyle},
      learnAlignment: {enabled: learnStyle},
      learnRadius: {enabled: learnStyle},
      learnShadow: {enabled: learnStyle},
      learnMT: {enabled: learnStyle},
      learnMB: {enabled: learnStyle},
    }
  },
  values: {},
  renderer: {
    Viewer: unlayer.createViewer({
      render(values) {
        return getProfileHTML(values);
      }
    }),
    exporters: {
      web: function(values) {
        return getProfileHTML(values);
      },
      email: function(values) {
        return getProfileHTML(values);
      }
    },
    head: {
      css: function(values) {},
      js: function(values) {}
    }
  }
});