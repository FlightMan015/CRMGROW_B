unlayer.registerTool({
  name: 'my_tool1',
  label: 'My Tool2',
  icon: 'fa-address-book',
  supportedDisplayModes: ['web', 'email'],
  options: {},
  values: {},
  renderer: {
    Viewer: unlayer.createViewer({
      render(values) {
        return "<div>I am a custom tool111.</div>"
      }
    }),
    exporters: {
      web: function(values) {
        return "<div>I am a custom tool.</div>"
      },
      email: function(values) {
        return "<div>I am a custom tool.</div>"
      }
    },
    head: {
      css: function(values) {},
      js: function(values) {}
    }
  }
});