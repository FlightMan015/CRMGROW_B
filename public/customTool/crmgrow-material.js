var PLAYER_PLACEHOLDER = 'https://stg-api.crmgrow.com/theme/unlayer/player.gif';
var MATERIAL_TITLE_PLACEHOLDER = 'CRMGrow Material Title would be here';
var MATERIAL_STYLES = {
  material_layout_4: ``
}
var MATERIAL_LAYOUTS = [
  {
    name: 'Material Layout 1',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout1.jpg',
    id: 'material_layout_1'
  },
  {
    name: 'Material Layout 2',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout2.jpg',
    id: 'material_layout_2'
  },
  {
    name: 'Material Layout 3',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout3.jpg',
    id: 'material_layout_3'
  }
];
var MATERIAL_AREA_LAYOUTS = [
  {
    name: 'Material Layout 1',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout1.jpg',
    id: 'material_layout_1'
  },
  {
    name: 'Material Layout 2',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout2.jpg',
    id: 'material_layout_2'
  },
  {
    name: 'Material Layout 3',
    image: 'https://stg-api.crmgrow.com/theme/unlayer/layout3.jpg',
    id: 'material_layout_3'
  }
];

function getMaterialHTML(values) {
  console.log('material JSON data', materialJson);
  let material = materialJson[values.materialField];
  if (!material) {
    material = values.data;
  }
  let html = '';
  switch (values.materialLayout) {
    case 'material_layout_1':
      html = `
        <table style="width: 100%;">
          <tbody>
            <tr>
              <td>
                <a class="material-object" href="{{${material._id}}}">
                  <img src="${material.preview}" style="width: 100%" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="
                text-align: center;
                text-align: ${values.titleAlignment};
                padding-top: ${(values.titleMT || '0') + 'px'};
                padding-bottom: ${(values.titleMB || '0') + 'px'};
              ">
                <a href="{{${material._id}}}" class="material-object" style="
                  color: ${values.titleColor};
                  font-size: ${values.titleFontSize}px; 
                  font-family: ${values.titleFont ? values.titleFont.value : ''};
                  text-decoration: none;
                  cursor: pointer;
                  ">
                  ${material.title}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      `
      break;
    case 'material_layout_2':
      html = `
        <table style="
          background-image: url(${material.preview});
          width: 100%;
          height: ${values.thumbnailHeight || '300'}px;
          background-repeat: no-repeat;
          background-size: contain;
          background-position: center;
          border-collapse: collapse;
          ">
          <tbody>
            <tr>
              <td style="
                text-align: center;
                text-align: ${values.titleAlignment};
                padding-top: ${(values.titleMT || '0') + 'px'};
                padding-bottom: ${(values.titleMB || '0') + 'px'};
                ">
                <a href="{{${material._id}}}" class="material-object" style="
                color: ${values.titleColor};
                font-size: ${values.titleFontSize}px; 
                font-family: ${values.titleFont ? values.titleFont.value : ''};
                text-decoration: none;
                cursor: pointer;
                ">
                  ${material.title}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      `
      break;
    case 'material_layout_3':
      html = `
        <table style="width: 100%;">
          <tbody>
            <tr>
              <td>
                <a href="{{${material._id}}}" class="material-object" style="
                cursor: pointer;
                ">
                  <img src="${material.preview}" style="width: 100%" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      `
      break;
  }
  return html;
}

function getMaterialAreaHTML(values) {
  let html = '';
  let style = '';
  switch (values.materialLayout) {
    case 'material_layout_1':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
            {{materials_with_material_layout_1}}
          </tbody>
        </table>
      `
      break;
    case 'material_layout_2':
    case 'material_layout_3':
    case 'material_layout_4':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
          .materials-wrapper .material-title {
            text-align: ${values.titleAlignment};
            padding-top: ${(values.titleMT || '0') + 'px'};
            padding-bottom: ${(values.titleMB || '0') + 'px'};
          }
          .materials-wrapper .material-title a{
            color: ${values.titleColor};
            font-size: ${values.titleFontSize}px; 
            font-family: ${values.titleFont ? values.titleFont.value : ''};
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
          {{materials_with_${values.materialLayout}}}
          </tbody>
        </table>
      `
      break;
  }
  return `
    ${style}
    ${html}
  `;
}


function getMaterialAreaEditorHTML(values) {
  let html = '';
  let style = '';
  switch (values.materialLayout) {
    case 'material_layout_1':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
            <tr>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>
            </tr>
          </tbody>
        </table>
      `
      break;
    case 'material_layout_2':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
          .materials-wrapper .material-title {
            text-align: ${values.titleAlignment};
            padding-top: ${(values.titleMT || '0') + 'px'};
            padding-bottom: ${(values.titleMB || '0') + 'px'};
          }
          .materials-wrapper .material-title a{
            color: ${values.titleColor};
            font-size: ${values.titleFontSize}px; 
            font-family: ${values.titleFont ? values.titleFont.value : ''};
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
            <tr>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>
              <td class="material-title">
                <a>
                  ${MATERIAL_TITLE_PLACEHOLDER}
                </a>
              </td>
            </tr>
            <tr>
              <td class="material-title">
                <a>
                  ${MATERIAL_TITLE_PLACEHOLDER}
                </a>
              </td>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>
            </tr>
          </tbody>
        </table>
      `
      break;
    case 'material_layout_3':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
          .materials-wrapper .material-title {
            text-align: ${values.titleAlignment};
            padding-top: ${(values.titleMT || '0') + 'px'};
            padding-bottom: ${(values.titleMB || '0') + 'px'};
          }
          .materials-wrapper .material-title a{
            color: ${values.titleColor};
            font-size: ${values.titleFontSize}px; 
            font-family: ${values.titleFont ? values.titleFont.value : ''};
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
            <tr>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>
              <td class="material-title">
                <a>
                  ${MATERIAL_TITLE_PLACEHOLDER}
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
              </td>  
              <td class="material-title">
                <a>
                  ${MATERIAL_TITLE_PLACEHOLDER}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      `;
      break;
    case 'material_layout_4':
      style = `
        <style>
          .materials-wrapper {
            width: 100%;
          }
          .materials-wrapper img{
            width: 100%;
          }
          .materials-wrapper .material-title {
            text-align: ${values.titleAlignment};
            padding-top: ${(values.titleMT || '0') + 'px'};
            padding-bottom: ${(values.titleMB || '0') + 'px'};
          }
          .materials-wrapper .material-title a{
            color: ${values.titleColor};
            font-size: ${values.titleFontSize}px; 
            font-family: ${values.titleFont ? values.titleFont.value : ''};
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      `;
      html = `
        <table class="materials-wrapper">
          <tbody class="materials-content">
            <tr>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
                <div class="material-title">
                  <a>${MATERIAL_TITLE_PLACEHOLDER}</a>
                </div>
              </td>
              <td>
                <img src="${PLAYER_PLACEHOLDER}" />
                <div class="material-title">
                  <a>${MATERIAL_TITLE_PLACEHOLDER}</a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      `;
      break;
  }
  return `
    ${style}
    ${html}
  `;
}

unlayer.registerPropertyEditor({
  name: 'material_content_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      // Materials Browser
      materialJson = {};
      var html = '';
      (data ? (data.options || []) : []).forEach((e) => {
        var el = `
          <div class="material-item">
            <input type="radio" id="${e._id}" name="material_field" value="${e._id}" class="material_field_type" ${value === e._id ? 'checked' : ''}>
            <label for="${e._id}">
              <img src="${e.thumbnail || e.preview}" style="width: 100%;"/>
              <span>${e.title}</span>
            </label>
          </div>
        `;
        html += el;
        materialJson[e._id] = e;
      });
      console.log('material JSON', materialJson);
      return `
        <style>
          .material-item {
            margin-left: -20px;
            margin-right: -20px;
          }
          .material-item input {
            display: none;
          }
          .material-item label {
            display: flex;
            padding: 4px 6px;
            margin-bottom: 0px;
          }
          .material-item label img {
            width: 60px!important;
            height: 35px;
            object-fit: contain;
            margin-right: 10px;
          }
          .material-item label span {
            font-size: 13px;
          }
          .material-item input:checked + label {
            background: #c4c4ff;
          }
        </style>
        ${html}
      `;
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          console.log('event.target.value', event.target.value);
          updateValue(event.target.value);
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
  name: 'material_area_layout_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let html = ``;
      MATERIAL_AREA_LAYOUTS.forEach(e => {
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

unlayer.registerTool({
  name: 'my_tool',
  label: 'CRM Material',
  icon: 'fa-photo-video',
  supportedDisplayModes: ['web', 'email'],
  options: {
    fields: {
      title: "Select Material",
      position: 1,
      options: {
        "materialField": {
          "label": "Material Field",
          "defaultValue": "5e2a05c94d04d37842cc8ff9",
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
        }
      }
    },
    playerStyle: {
      title: 'Thumbnail Style',
      position: 3,
      options: {
        thumbnailHeight: {
          label: 'Thumbnail Height',
          defaultValue: '300',
          widget: 'counter'
        }
        // thumbnailOverlay: {
        //   label: 'Thumbnail Overlay Color',
        //   defaultValue: '#000',
        //   widget: 'color_picker'
        // },
        // thumbnailOverlayOpacity: {
        //   label: 'Thumbnail Overlay Opacity',
        //   defaultValue: '50',
        //   widget: 'counter'
        // }
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
        titleMT: {
          label: 'Top Margin',
          defaultValue: '15',
          widget: 'counter'
        },
        titleMB: {
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
    if (values.materialLayout === 'material_layout_1') {
      playerStyle = true;
    } else {
      playerStyle = false;
    }
    return {
      materialLayout: {
        enabled: layoutStatus
      },
      thumbnailHeight: {
        enabled: playerStyle
      },
      layoutFields: {
        enabled: layoutStatus
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



// unlayer.registerTool({
//   name: 'material_area',
//   label: 'Additional CRM Material area',
//   icon: 'fa-photo-video',
//   supportedDisplayModes: ['web', 'email'],
//   options: {
//     layouts: {
//       title: "Material Blocks",
//       position: 1,
//       options: {
//         "materialLayout": {
//           label: "Material Layout",
//           defaultValue: "material_layout_1",
//           widget: "material_area_layout_selector"
//         }
//       }
//     },
//     // playerStyle: {
//     //   title: 'Thumbnail Style',
//     //   position: 2,
//     //   options: {
//     //     thumbnailOverlay: {
//     //       label: 'Thumbnail Overlay Color',
//     //       defaultValue: '#000',
//     //       widget: 'color_picker'
//     //     },
//     //     thumbnailOverlayOpacity: {
//     //       label: 'Thumbnail Overlay Opacity',
//     //       defaultValue: '50',
//     //       widget: 'counter'
//     //     }
//     //   }
//     // },
//     titleStyle: {
//       title: "Title Style",
//       position: 3,
//       options: {
//         "titleAlignment": {
//           "label": "Alignment",
//           "defaultValue": "center",
//           "widget": "alignment"
//         },
//         "titleColor": {
//           "label": "Text Color",
//           "defaultValue": "#000",
//           "widget": "color_picker"
//         },
//         "titleFont": {
//           label: "Font",
//           "defaultValue": {
//             label: 'Arial',
//             value: 'arial,helvetica,sans-serif'
//           },
//           "widget": "font_family"
//         },
//         "titleFontSize": {
//           label: "Font Size",
//           defaultValue: 24,
//           "widget": 'font_size_selector'
//         },
//         titleMT: {
//           label: 'Top Margin',
//           defaultValue: '15',
//           widget: 'counter'
//         },
//         titleMB: {
//           label: 'Bottom Margin',
//           defaultValue: '15',
//           widget: 'counter'
//         }
//       }
//     }
//   },
//   propertyStates: (values) => {
//     let layoutStatus = true;
//     let playerStyle = true;
//     let titleStyle = true;
//     return {
//       materialLayout: {
//         enabled: layoutStatus
//       },
//       layoutFields: {
//         enabled: layoutStatus
//       },
//       titleAlignment: {
//         enabled: titleStyle
//       },
//       titleColor: {
//         enabled: titleStyle
//       },
//       titleFont: {
//         enabled: titleStyle
//       },
//       titleFontSize: {
//         enabled: titleStyle
//       },
//       titleMB: {
//         enabled: playerStyle
//       },
//       descMB: {
//         enabled: playerStyle
//       }
//     }
//   },
//   values: {},
//   renderer: {
//     Viewer: unlayer.createViewer({
//       render(values) {
//         let html = getMaterialAreaEditorHTML(values);
//         return html;
//       }
//     }),
//     exporters: {
//       web: function(values) {
//         let html = getMaterialAreaHTML(values);
//         return html;
//       },
//       email: function(values) {
//         let html = getMaterialAreaHTML(values);
//         return html;
//       }
//     },
//     head: {
//       css: function(values) {},
//       js: function(values) {}
//     }
//   }
// });


