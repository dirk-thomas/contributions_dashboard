/**
 * Provider generating test data
 * into the statistics dashboard.
 *
 * Copyright (c) 2013-2015, Dirk Thomas
 * Distributed under the BSD 2-Clause license
 * https://github.com/dirk-thomas/statistics_dashboard/
 **/

(function(namespace, statistics_dashboard_namespace) {

  namespace.TestModel = Backbone.Model.extend({
    initialize: function() {
      console.debug('TestModel.initialize()');
      this.logged_in = false;
    },
    login: function (options) {
      console.debug('TestModel.login()');
      this.logged_in = true;
      this.trigger('logged_in');
    },
    logout: function() {
      console.log('TestModel.logout()');
      this.logged_in = false;
      this.trigger('logged_out');
    },
    refresh_groups: function() {
      console.log('TestModel.refresh_groups()');
      this.trigger('refresh_groups');
    },
  });


  namespace.LoginView = Backbone.View.extend({
    tagName: 'div',
    className: 'login test_login',
    events: {
      'click .login_button': 'login',
      'click .hide_button': 'hide',
    },
    initialize: function(test_model) {
      console.debug('LoginView.initialize()');
      this.test_model = test_model;
      this.listenTo(this.test_model, 'logged_in', this.hide);
    },
    render: function() {
      console.debug('LoginView.render()');
      if (!this.test_model.logged_in) {
        console.debug('LoginView.render() not logged in');
        var tmpl = _.template($("#test-login-form").html());
        this.$el.html(tmpl());
      } else {
        this.hide();
      }
      return this;
    },
    show: function(event) {
      if (event) {
        event.preventDefault();
      }
      this.render();
      this.$el.show();
    },
    hide: function(event) {
      if (event && event.preventDefault) {
        event.preventDefault();
      }
      this.$el.hide();
      this.$el.html('');
    },
    login: function(event) {
      if (event) {
        event.preventDefault();
      }
      console.debug('LoginView.login()');
      this.test_model.login();
    },
  });


  namespace.StatusView = Backbone.View.extend({
    tagName: 'div',
    className: 'status',
    events: {
      'click .add_group_button': 'increment_groups',
      'click .remove_group_button': 'decrement_groups',
      'click .add_repo_button': 'increment_repos',
      'click .remove_repo_button': 'decrement_repos',
      'click .add_contribution_button': 'increment_contributions',
      'click .remove_contribution_button': 'decrement_contributions',
      'click .login_button': 'login',
      'click .logout_button': 'logout',
      'click .query_groups': 'refresh_groups',
    },
    initialize: function(test_model, login_view) {
      console.debug('StatusView.initialize()');
      this.test_model = test_model;
      this.login_view = login_view;
      this.listenTo(this.test_model, 'change', this.render);
      this.listenTo(this.test_model, 'logged_in', this.render);
      this.listenTo(this.test_model, 'logged_out', this.render);
    },
    render: function() {
      console.debug('StatusView.render()');
      if (!this.test_model.logged_in) {
        console.debug('StatusView.render() not logged in');
        var tmpl = _.template($("#test-status-not-logged-in").html());
        this.$el.html(tmpl());
      } else {
        console.debug('StatusView.render() logged in');
        var tmpl = _.template($("#test-status-logged-in").html());
        var groups = this.test_model.get('groups');
        var repos = this.test_model.get('repos');
        var contributions = this.test_model.get('contributions');
        this.$el.html(tmpl({groups: groups, repos: repos, contributions: contributions}));
      }
      return this;
    },
    increment_groups: function() {
      console.debug('StatusView.increment_groups()');
      var groups = this.test_model.get('groups');
      this.test_model.set({groups: groups + 1});
    },
    decrement_groups: function() {
      console.debug('StatusView.decrement_groups()');
      var groups = this.test_model.get('groups');
      if (groups > 0) {
        this.test_model.set({groups: groups - 1});
      }
    },
    increment_repos: function() {
      console.debug('StatusView.increment_repos()');
      var repos = this.test_model.get('repos');
      this.test_model.set({repos: repos + 1});
    },
    decrement_repos: function() {
      console.debug('StatusView.decrement_repos()');
      var repos = this.test_model.get('repos');
      if (repos > 0) {
        this.test_model.set({repos: repos - 1});
      }
    },
    increment_contributions: function() {
      console.debug('StatusView.increment_statistics()');
      var statistics = this.test_model.get('statistics');
      this.test_model.set({statistics: statistics + 1});
    },
    decrement_statistics: function() {
      console.debug('StatusView.decrement_statistics()');
      var statistics = this.test_model.get('statistics');
      if (statistics > 0) {
        this.test_model.set({statistics: statistics - 1});
      }
    },
    login: function(event) {
      event.preventDefault();
      this.login_view.show();
    },
    logout: function(event) {
      event.preventDefault();
      this.test_model.logout();
    },
    refresh_groups: function(event) {
      this.test_model.refresh_groups();
    },
  });


  namespace.DashboardView = Backbone.View.extend({
    tagName: 'div',
    className: 'test',
    initialize: function(test_model) {
      console.debug('DashboardView.initialize()');
      this.test_model = test_model;
      var self = this;

      function _query_groups(group_collection) {
        console.debug('_query_groups()');
        var models = [];
        for (var i = 1; i <= self.test_model.get('groups'); i++) {
          console.debug('query_groups() add group');
          var data = {
            id: 'G' + i,
            name: 'G' + i,
            avatar_url: null,
            starred_repos: [],
          };
          for (var j = 1; j <= self.test_model.get('repos'); j++) {
            if (j % 3 == 0) {
              data['starred_repos'].push('R' + j)
            }
          }
          models.push(new statistics_dashboard_namespace.GroupModel(data));
        }
        group_collection.set(models);
      }

      function _query_group_repos(model, repository_collection, complete_callback) {
        console.debug('_query_group_repos()');
        var models = [];
        for (var i = 1; i <= self.test_model.get('repos'); i++) {
          console.debug('query_repos() add repo');
          var data = {
            id: 'R' + i,
            name: 'R' + i,
            full_name: 'R' + i,
            repo_url: '',
            contributions_url: '',
            is_starred: i % 3 == 0,
          };
          models.push(new statistics_dashboard_namespace.RepositoryModel(data));
        }
        setTimeout(function(){
          repository_collection.set(models);
          if (complete_callback) {
            complete_callback();
          }
        }, 250);
      }

      function _query_repo_contributions(model, contribution_collection, complete_callback) {
        console.debug('_query_repo_contributions()');
        var models = [];
        for (var i = self.test_model.get('contributions'); i > 0; i--) {
          console.debug('query_repos() add contribution');
          var data = {
            id: 'I' + i,
            number: i,
            title: 'I' + i,
            issue_url: '',
            creator: 'creator',
            assignee: i % 3 == 0 ? 'assigne_is_me' : (i % 3 == 1 ? 'assignee' : null),
            assignee_is_me:  i % 3 == 0,
            pull_request: i % 2 == 0,
            updated_at: i,
            labels: [],
          };
          models.push(new statistics_dashboard_namespace.ContributionModel(data));
        }
        setTimeout(function(){
          contribution_collection.set(models);
          if (complete_callback) {
            complete_callback();
          }
        }, 250);
      }

      this.group_collection = new statistics_dashboard_namespace.GroupCollection();
      this.group_list_view = new statistics_dashboard_namespace.GroupListView({
        collection: this.group_collection,
        query_groups: _query_groups,
        query_group_repos: _query_group_repos,
        query_repo_contributions: _query_repo_contributions,
      });
      this.$el.append(this.group_list_view.render().el);

      this.listenTo(this.test_model, 'logged_in', this.logged_in);
      this.listenTo(this.test_model, 'logged_out', this.logged_out);
      this.listenTo(this.test_model, 'refresh_groups', this.refresh_groups);
    },
    set_filter_model: function(filter_model) {
      this.group_list_view.set_filter_model(filter_model);
    },
    render: function() {
      console.debug('DashboardView.render()');
      return this;
    },
    logged_in: function() {
      console.debug('DashboardView.logged_in()');
      this.group_list_view.query_groups();
    },
    logged_out: function() {
      console.debug('DashboardView.logged_out()');
      this.group_collection.reset();
    },
    refresh_groups: function() {
      console.debug('DashboardView.refresh_groups()');
      this.group_list_view.query_groups();
    },
  });


  namespace.TestProvider = function() {
    this.test_model = new namespace.TestModel({groups: 1, repos: 1, contributions: 1});
    this.login_view = new namespace.LoginView(this.test_model);
    this.status_view = new namespace.StatusView(this.test_model, this.login_view);
    this.dashboard_view = new namespace.DashboardView(this.test_model);

    this.login = function(options) {
      console.debug('TestProvider.login()');
      this.test_model.login();
    };

    this.get_name = function() {
      return 'Test';
    };

    this.get_status_view = function() {
      return this.status_view;
    };

    this.get_login_view = function() {
      return this.login_view;
    };

    this.get_dashboard_view = function() {
      return this.dashboard_view;
    };
  };

})(window.test_provider = window.test_provider || {}, window.statistics_dashboard);
