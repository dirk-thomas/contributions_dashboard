(function($) {

  window.debug = url('?debug') !== null;
  if (!window.debug) {
    console.debug = function() {};
  }

  var dashboard = new statistics_dashboard.StatisticsDashboardView();
  $('#main').append(dashboard.render().el);

  var github = new github_provider.GitHubProvider();
  github.get_dashboard_view().set_filter_model(dashboard.get_filter_model());
  dashboard.add_provider(github);

  /*var test = new test_provider.TestProvider();
  test.get_dashboard_view().set_filter_model(dashboard.get_filter_model());
  dashboard.add_provider(test);*/

  // auto-login
  /*var options = {
    auth: 'oauth',
    token: '',
  };*/
  // or
  /*var options = {
    auth: 'basic',
    username: '',
    password: '',
  }*/
  //github.login(options);

  //test.login();

})(jQuery);
