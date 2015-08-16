/**
 * Statistics dashboard visualizes contributions
 * from various platforms in a single user interface.
 *
 * Copyright (c) 2013-2015, Dirk Thomas
 * Distributed under the BSD 2-Clause license
 * https://github.com/dirk-thomas/statistics_dashboard/
 **/

(function(namespace) {

  /*
   * A contribution model has the following attributes:
   * - login
   * - timestamp
   * - additions
   * - deletions
   * - commits
   *   matches_filter (populated by the ContributionView)
   */
  namespace.ContributionModel = Backbone.Model.extend({
  });

  namespace.ContributionCollection = Backbone.Collection.extend({
    model: namespace.ContributionModel,
    // plain attribute comparator fails to order descending:
    /*comparator: function(model) {
      return - model.get('timestamp');
    },*/
    comparator: function(a, b) {
      ts_a = a.get('timestamp').toISOString();
      ts_b = b.get('timestamp').toISOString();
      // inverted order
      if (ts_a < ts_b) return 1;
      if (ts_a > ts_b) return -1;

      login_a = a.get('login');
      login_b = b.get('login');
      if (login_a < login_b) return -1;
      if (login_a > login_b) return 1;
      return 0;
    },
    set: function(models, options) {
      models.sort(this.comparator);
      return Backbone.Collection.prototype.set.call(this, models, options);
    },
  });

  namespace.ContributionView = Backbone.View.extend({
    tagName: 'div',
    className: 'contribution',
    template: _.template($('#contribution-template').html()),
    initialize: function(options) {
      console.debug('ContributionView.initialize() contribution ' + this.model.get('timestamp') + ':' + this.model.get('login'));
      this._filter_model = options.filter_model;
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'destroy', this.remove);
      this.update_filter_match();
    },
    render: function() {
      console.debug('ContributionView.render() contribution ' + this.model.get('timestamp') + ':' + this.model.get('login'));
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    },
    update_filter_match: function() {
      console.debug('ContributionView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_contribution(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('ContributionView.update_filter_match() ' + matches_filter);
      this.model.set({matches_filter: matches_filter});
    },
  });

  namespace.ContributionListView = Backbone.View.extend({
    tagName: 'div',
    className: 'contributionlist',
    initialize: function(options) {
      console.debug('ContributionListView.initialize()');
      this._filter_model = options.filter_model;
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
      this.listenTo(this.collection, 'sort', this.render);
    },
    render: function() {
      console.debug('ContributionListView.render()');
      return this;
    },
    addOne: function(model) {
      var view = new namespace.ContributionView({
        model: model,
        filter_model: this._filter_model,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('ContributionListView.addOne() contribution ' + model.get('timestamp') + ':' + model.get('login') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('ContributionListView.addOne() contribution ' + model.get('timestamp') + ':' + model.get('login') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('ContributionListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
      this.collection.sort();
    },
    removeOne: function(model, collection, options) {
      console.debug('ContributionListView.removeOne() contribution ' + model.get('timestamp') + ':' + model.get('login'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      // in order for this to work the list of contributions added with collection.set(contributions)
      // must in the correct order, meaning newest to oldest
      return this.$('>' + namespace.ContributionView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  namespace.ContributionCount = function() {
    this.additions = 0;
    this.deletions = 0;
    this.commits = 0;
    this.addContributionCount = function(count) {
      this.additions += count.additions;
      this.deletions += count.deletions;
      this.commits += count.commits;
    };
    this.addContributionModel = function(model) {
      this.additions += model.get('additions');
      this.deletions += model.get('deletions');
      this.commits += model.get('commits');
    };
    this.reset = function() {
      this.additions = 0;
      this.deletions = 0;
      this.commits = 0;
    };
  };

  namespace.ContributionSummary = function() {
    this.summary = new namespace.ContributionCount();
    this.by_login = {};
    this.ordered_logins = {'additions': [], 'deletions': [], 'commits': []};
    this.addContributionModel = function(model) {
      this.summary.addContributionModel(model);
      if (!(model.get('login') in this.by_login)) {
        this.by_login[model.get('login')] = new namespace.ContributionCount();
      }
      this.by_login[model.get('login')].addContributionModel(model);
    };
    this.addContributionSummary = function(summary) {
      if (!summary) {
        return;
      }
      this.summary.addContributionCount(summary.summary);
      for (var login in summary.by_login) {
        if (!(login in this.by_login)) {
          this.by_login[login] = new namespace.ContributionCount();
        }
        this.by_login[login].addContributionCount(summary.by_login[login]);
      }
    };
    this.updateLoginOrder = function() {
      // order the logins by descending contribution count for each separate kind
      for (var kind in this.ordered_logins) {
        var counts = {};
        for (var login in this.by_login) {
          counts[login] = this.by_login[login][kind];
        }
        this.ordered_logins[kind] = Object.keys(counts).sort(function(a, b) {
          if (counts[a] != counts[b]) {
            return counts[b] - counts[a];
          }
          return a < b ? -1 : a > b;
        });
      }
    };
    this.reset = function() {
      this.summary.reset();
      this.by_login = {};
      this.ordered_logins = {'additions': [], 'deletions': [], 'commits': []};
    };
  };


  /*
   * A repository model has the following attributes:
   * - id
   * - name
   * - full_name
   * - repo_url
   * - contributions_url
   * - is_starred
   * - contribution_summary (populated by the RepositoryView, aggregated from the collection of ContributionModels)
   * - matched_contribution_summary (populated by the RepositoryView, aggregated from the collection of ContributionModels)
   *   matches_filter (populated by the RepositoryView)
   */
  namespace.RepositoryModel = Backbone.Model.extend({
  });

  namespace.RepositoryCollection = Backbone.Collection.extend({
    model: namespace.RepositoryModel,
    comparator: function(model) {
      return model.get('full_name').toLowerCase();
    },
  });

  namespace.RepositoryView = Backbone.View.extend({
    tagName: 'div',
    className: 'repo',
    template: _.template($('#repo-header-template').html()),
    events: {
      'click a': 'skip_event',
      'click .repo_header': 'toggle_contributionlist',
      'click .reset_contributions': 'reset_contributions',
      'click .query_contributions': 'query_contributions',
      'click .compute_contributions': 'query_contributions',
    },
    initialize: function(options) {
      console.debug('RepositoryView.initialize() full_name: ' + this.model.get('full_name'));
      this._filter_model = options.filter_model;
      this._query_contributors_stats = options.query_contributors_stats;
      this.$el.html('<div class="repo_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:is_starred', this.update_filter_match);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this._filter_model, 'change:starred', this.update_filter_match);
      this.contributions_queried = false;
      this.contributionlist_folded = true;

      this.contribution_collection = new namespace.ContributionCollection();
      this.listenTo(this.contribution_collection, 'add', this.contribution_collection_changed);
      this.listenTo(this.contribution_collection, 'remove', this.contribution_collection_changed);
      this.listenTo(this.contribution_collection, 'reset', this.contribution_collection_changed);
      var view = new namespace.ContributionListView({
        collection: this.contribution_collection,
        filter_model: this._filter_model,
      });
      this.$el.append(view.render().el);
      this.update_filter_match();
    },
    render: function() {
      console.debug('RepositoryView.render() full_name: ' + this.model.get('full_name'));
      // can't use a default value in order to not overwrite values
      // when models are updated with new models from the provider
      var missing = !this.model.has('contribution_summary');
      if (missing) {
        this.model.set({
          contribution_summary: new namespace.ContributionSummary(),
          matched_contribution_summary: new namespace.ContributionSummary()}, {silent: true});
      }
      this.$('.repo_header').html(this.template(this.model.toJSON()));
      if (missing) {
        this.model.unset('contribution_summary', {silent: true});
        this.model.unset('matched_contribution_summary', {silent: true});
      }

      this.$('.repo_header .loader').hide();
      if (this.contributionlist_folded) {
        this.$('.glyphicon-folder-open').hide();
        this.$('.contributionlist').hide();
      } else {
        this.$('.glyphicon-folder-close').hide();
        this.$('.contributionlist').show();
      }
      return this;
    },
    update_filter_match: function() {
      console.debug('RepositoryView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_repo(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('RepositoryView.update_filter_match() ' + matches_filter);
      this.model.set({matches_filter: matches_filter});
    },
    skip_event: function(event) {
      event.stopPropagation();
    },
    toggle_contributionlist: function() {
      console.log('RepositoryView.toggle_contributionlist() full_name: ' + this.model.get('full_name'));
      if (!this.contributions_queried) {
        this.query_contributions();
      } else if (this.contributionlist_folded) {
        this.show_contributions();
      } else {
        this.hide_contributions();
      }
    },
    reset_contributions: function(event) {
      console.log('RepositoryView.reset_contributions() full_name: ' + this.model.get('full_name'));
      if (event) {
        event.stopPropagation();
      }
      this.contributions_queried = false;
      this.$('.repo_header .reset_contributions').css('visibility', 'hidden');
      this.model.unset('contribution_summary');
      this.model.unset('matched_contribution_summary');
      this.hide_contributions();
    },
    query_contributions: function(event) {
      console.log('RepositoryView.query_contributions() full_name: ' + this.model.get('full_name'));
      if (event) {
        event.stopPropagation();
      }
      this.$('.repo_header .query_contributions').hide();
      this.$('.repo_header .compute_contributions').hide();
      this.$('.repo_header .loader').show();
      this._query_contributors_stats(this.model, this.contribution_collection, $.proxy(this.query_contributions_completed, this));
    },
    query_contributions_completed: function(loaded) {
      console.log('RepositoryView.query_contributions_completed() loaded: ' + loaded);
      this.$('.repo_header .query_contributions').css('display', '');
      this.$('.repo_header .loader').hide();
      if (loaded === false) {
        this.$('.repo_header .compute_contributions').show();
      }
      if (loaded === true) {
        this.$('.repo_header .reset_contributions').css('visibility', 'visible');
        if (!this.contributions_queried) {
          //this.show_contributions();
          this.contributions_queried = true;
          if (!this.contribution_collection.length) {
            // manually trigger model update when no contributions are found
            this.contribution_collection_changed();
          }
        }
      }
    },
    show_contributions: function() {
      console.debug('RepositoryView.show_contributions() full_name: ' + this.model.get('full_name'));
      this.$('.glyphicon-folder-close').hide();
      this.$('.glyphicon-folder-open').show();
      if (this.contribution_collection.length > 0) {
        this.$('.contributionlist').show();
        var height = this.$('.contributionlist').css('height', 'auto').css('height');
        this.$('.contributionlist').css('height', 0);
        var contributionlist = this.$('.contributionlist');
        this.$('.contributionlist').animate({'height': height + 'px'}, {speed: 200, queue: false, always: function(){
          contributionlist.css('height', 'auto');
        }});
      }
      this.contributionlist_folded = false;
    },
    hide_contributions: function() {
      console.debug('RepositoryView.hide_contributions() full_name: ' + this.model.get('full_name'));
      this.$('.glyphicon-folder-close').show();
      this.$('.glyphicon-folder-open').hide();
      var contributionlist = this.$('.contributionlist');
      this.$('.contributionlist').animate({'height': '0px'}, {speed: 200, queue: false, always: function(){
        contributionlist.hide();
      }});
      this.contributionlist_folded = true;
    },
    contribution_collection_changed: function() {
      console.debug('RepositoryView.contribution_collection_changed() full_name: ' + this.model.get('full_name'));
      var summary = new namespace.ContributionSummary();
      this.contribution_collection.each(function(contribution_model, index) {
        summary.addContributionModel(contribution_model);
      });
      summary.updateLoginOrder();
      this.model.set({'contribution_summary': summary});
      this.update_matched_contribution_summary();
    },
    update_matched_contribution_summary: function() {
      console.debug('RepositoryView.update_matched_contribution_summary() full_name: ' + this.model.get('full_name'));
      var summary = new namespace.ContributionSummary();
      this.contribution_collection.each(function(contribution_model, index) {
        if (contribution_model.get('matches_filter')) {
          summary.addContributionModel(contribution_model);
        }
      });
      summary.updateLoginOrder();
      console.debug('RepositoryView.update_matched_contribution_summary() full_name: ' + this.model.get('full_name') + ' ' + summary);
      this.model.set({matched_contribution_summary: summary});
    },
  });

  namespace.RepositoryListView = Backbone.View.extend({
    tagName: 'div',
    className: 'repolist',
    initialize: function(options) {
      console.debug('RepositoryListView.initialize()');
      this._filter_model = options.filter_model;
      this._query_contributors_stats = options.query_contributors_stats;
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
    },
    render: function() {
      console.debug('RepositoryListView.render()');
      return this;
    },
    addOne: function(model) {
      var view = new namespace.RepositoryView({
        model: model,
        filter_model: this._filter_model,
        query_contributors_stats: this._query_contributors_stats,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('RepositoryListView.addOne() repo ' + model.get('full_name') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('RepositoryListView.addOne() repo ' + model.get('full_name') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('RepositoryListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    removeOne: function(model, collection, options) {
      console.debug('RepositoryListView.removeOne() repo: ' + model.get('full_name'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      return this.$('>' + namespace.RepositoryView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  /*
   * A group model has the following attributes:
   * - id
   * - name
   * - avatar_url
   * - starred_repos
   * - contribution_summary (populated by the RepositoryViewGroupView, aggregated from the collection of RepositoryModels)
   * - matched_contribution_summary (populated by the GroupView, aggregated from the collection of RepositoryModels)
   *   matches_filter (populated by the GroupView)
   */
  namespace.GroupModel = Backbone.Model.extend({
    defaults: {
      'contribution_summary': new namespace.ContributionSummary(),
      'matched_contribution_summary': new namespace.ContributionSummary(),
    },
  });

  namespace.GroupCollection = Backbone.Collection.extend({
    model: namespace.GroupModel,
    comparator: function(model) {
      return model.get('name').toLowerCase();
    },
  });

  namespace.GroupView = Backbone.View.extend({
    tagName: 'div',
    className: 'group',
    template: _.template($('#group-header-template').html()),
    events: {
      'click a': 'skip_event',
      'click .group_header': 'toggle_repolist',
      'click .query_repos': 'query_repos',
    },
    initialize: function(options) {
      console.debug('GroupView.initialize() group: ' + this.model.get('name'));
      this._filter_model = options.filter_model;
      this._query_group_repos = options.query_group_repos;
      this._query_contributors_stats = options.query_contributors_stats;
      this.$el.html('<div class="group_header"></div>');
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:starred_repos', this.update_filter_match);
      this.listenTo(this.model, 'change:starred_repos', this.update_starred_repos);
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this._filter_model, 'change:starred', this.update_filter_match);
      this.repolist_state = null;

      this.repository_collection = new namespace.RepositoryCollection();
      this.listenTo(this.repository_collection, 'add', this.add_repo);
      this.listenTo(this.repository_collection, 'remove', this.remove_repo);
      this.listenTo(this.repository_collection, 'reset', this.reset_repos);
      this.listenTo(this.repository_collection, 'change:contribution_summary', this.update_contribution_summary);
      this.listenTo(this.repository_collection, 'change:matched_contribution_summary', this.update_matched_contribution_summary);
      var view = new namespace.RepositoryListView({
        collection: this.repository_collection,
        filter_model: this._filter_model,
        query_contributors_stats: this._query_contributors_stats,
      });
      this.$el.append(view.render().el);
      this.update_filter_match();
    },
    render: function() {
      console.debug('GroupView.render() group: ' + this.model.get('name'));
      this.$('.group_header').html(this.template(this.model.toJSON()));
      this.$('.group_header .loader').hide();
      if (this.repository_collection.length == 0) {
        this.$('.repolist').hide();
      }
      return this;
    },
    update_filter_match: function() {
      console.debug('GroupView.update_filter_match()');
      var old_matches_filter = this.model.get('matches_filter');
      var matches_filter = this._filter_model.match_group(this.model);
      if (matches_filter) {
        this.$el.show();
      } else {
        this.$el.hide();
      }
      console.debug('GroupView.update_filter_match() ' + matches_filter);
      this.model.set({matches_filter: matches_filter});
      //this.update_open_issue_count();
    },
    skip_event: function(event) {
      event.stopPropagation();
    },
    toggle_repolist: function() {
      console.log('GroupView.toggle_repolist() group: ' + this.model.get('name'));
      if (this.repolist_state === null) {
        this.query_repos();
      } else if (this.repolist_state) {
        this.hide_repos();
      } else {
        this.show_repos();
      }
    },
    query_repos: function(event) {
      console.debug('GroupView.query_repos() group: ' + this.model.get('name'));
      if (event) {
        event.stopPropagation();
      }
      this.$('.group_header .query_repos').hide();
      this.$('.group_header .loader').show();
      this._query_group_repos(this.model, this.repository_collection, $.proxy(this.query_repos_completed, this));
    },
    query_repos_completed: function() {
      this.$('.group_header .query_repos').css('display', '');
      this.$('.group_header .loader').hide();
    },
    show_repos: function() {
      console.debug('GroupView.show_repos() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.$('.repolist').show();
        var height = this.$('.repolist').css('height', 'auto').css('height');
        this.$('.repolist').css('height', 0);
        var repolist = this.$('.repolist');
        this.$('.repolist').animate({'height': height + 'px', 'margin-top': '5px'}, {speed: 200, queue: false, always: function(){
          repolist.css('height', 'auto');
        }});
        this.repolist_state = true;
      }
    },
    hide_repos: function() {
      console.debug('GroupView.hide_repos() group: ' + this.model.get('name'));
      var repolist = this.$('.repolist');
      this.$('.repolist').animate({'height': '0px', 'margin-top': '0px'}, {speed: 200, queue: false, always: function(){
        repolist.hide();
      }});
      this.repolist_state = false;
    },
    add_repo: function(repo_model) {
      console.debug('GroupView.add_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      this.show_repos();

      if (this._filter_model.match_repo(repo_model)) {
        //var count = repo_model.get('open_issue_count');
        //this.model.set({open_issue_count: this.model.get('open_issue_count') + count});
      }
    },
    remove_repo: function(repo_model) {
      console.debug('GroupView.remove_repo() group: ' + this.model.get('name') + ' repo ' + repo_model.get('full_name'));
      if (this.repository_collection.length == 0) {
        this.hide_repos();
      }

      if (this._filter_model.match_repo(repo_model)) {
        //var count = repo_model.get('open_issue_count');
        //this.model.set({open_issue_count: this.model.get('open_issue_count') - count});
      }
    },
    reset_repos: function(repo_models) {
      console.debug('GroupView.reset_repos() group: ' + this.model.get('name'));
      if (this.repository_collection.length > 0) {
        this.show_repos();
      } else {
        this.hide_repos();
      }
      this.update_contribution_summary();
    },
    update_contribution_summary: function() {
      console.debug('GroupView.update_contribution_summary() group: ' + this.model.get('name'));
      var summary = new namespace.ContributionSummary();
      this.repository_collection.each(function(repo_model, index) {
        summary.addContributionSummary(repo_model.get('contribution_summary'));
      });
      summary.updateLoginOrder();
      this.model.set({'contribution_summary': summary});
      this.update_matched_contribution_summary();
    },
    update_matched_contribution_summary: function(repo_model) {
      console.debug('GroupView.update_matched_contribution_summary() group: ' + this.model.get('name'));
      return;
      var model_count = this.model.get('matched_issue_count');
      var repo_model_previous_count = null;
      if (repo_model) {
        repo_model.previous('matched_issue_count');
      }
      // can't use previous count since for multiple adds the previous value is the same value which would result in increasing offsets
      // therefore not using the offset at all but recompute the sum every time
      if (false && model_count != null && repo_model_previous_count != null && typeof repo_model_previous_count != 'undefined') {
        // update group model only by offset of repo model
        if (this._filter_model.match_repo(repo_model)) {
          var offset = repo_model.get('matched_issue_count') - repo_model_previous_count;
          console.debug('GroupView.update_matched_contribution_summary() group: ' + this.model.get('name') + ' offset ' + offset);
          this.model.set({matched_issue_count: model_count + offset});
        }
      } else {
        // calculate sum of all repo models
        var matched_issue_count = 0;
        var filter_model = this._filter_model;
        this.repository_collection.each(function(repo_model, index) {
          if (filter_model.match_repo(repo_model)) {
            var count = repo_model.get('matched_issue_count');
            if (count != null) {
              //console.debug('GroupView.update_matched_contribution_summary() repo ' + repo_model.get('full_name') + ' count ' + count);
              matched_issue_count += count;
            } else {
              //console.debug('GroupView.update_matched_contribution_summary() repo ' + repo_model.get('full_name') + ' "null" ' + repo_model.get('open_issue_count'));
              matched_issue_count += repo_model.get('open_issue_count');
            }
          }
        });
        //console.debug('GroupView.update_matched_contribution_summary() group: ' + this.model.get('name') + ' all ' + matched_issue_count);
        this.model.set({matched_issue_count: matched_issue_count});
      }
    },
    update_starred_repos: function() {
      console.debug('GroupView.update_starred_repos() group: ' + this.model.get('name'));
      var starred_repos = this.model.get('starred_repos');
      this.repository_collection.each(function(repo_model, index) {
        is_starred = starred_repos.indexOf(repo_model.get('name')) != -1;
        repo_model.set({is_starred: is_starred});
      });
    },
  });

  namespace.GroupListView = Backbone.View.extend({
    tagName: 'div',
    className: 'grouplist',
    initialize: function(options) {
      console.debug('GroupListView.initialize()');
      this._filter_model = null;
      this._query_groups = options.query_groups;
      this._query_group_repos = options.query_group_repos;
      this._query_contributors_stats = options.query_contributors_stats;
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'remove', this.removeOne);
    },
    set_filter_model: function(filter_model) {
      console.debug('GroupListView.set_filter_model()');
      this._filter_model = filter_model;
    },
    render: function() {
      console.debug('GroupListView.render()');
      return this;
    },
    query_groups: function() {
      console.log('GroupListView.query_groups()');
      this._query_groups(this.collection);
    },
    addOne: function(model) {
      var view = new namespace.GroupView({
        model: model,
        filter_model: this._filter_model,
        query_group_repos: this._query_group_repos,
        query_contributors_stats: this._query_contributors_stats,
      });
      var index = this.collection.indexOf(model);
      var view_at_index = this._get_element_of_index(index);
      if (view_at_index.length) {
        console.debug('GroupListView.addOne() group: ' + model.get('name') + ' at index ' + index.toString());
        view_at_index.before(view.render().el);
      } else {
        console.debug('GroupListView.addOne() group: ' + model.get('name') + ' at the end');
        this.$el.append(view.render().el);
      }
    },
    addAll: function() {
      console.debug('GroupListView.addAll()');
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },
    removeOne: function(model, collection, options) {
      console.debug('GroupListView.removeOne() group: ' + model.get('name'));
      this._get_element_of_index(options.index).remove();
    },
    _get_element_of_index: function (index) {
      return this.$('>' + namespace.GroupView.prototype.tagName + ':eq(' + index.toString() + ')');
    }
  });


  /*
   * A filter model has the following attributes:
   * - starred
   */
  namespace.FilterModel = Backbone.Model.extend({
    defaults: {
      'starred': false,
    },
    match_group: function(group_model) {
      var starred = this.get('starred');
      if (!starred) {
        return true;
      }
      console.log('FilterModel.match_group() starred ' + group_model.get('name'));
      return group_model.get('starred_repos').length > 0;
    },
    match_repo: function(repo_model) {
      var starred = this.get('starred');
      if (!starred) {
        return true;
      }
      console.log('FilterModel.match_repo() starred ' + repo_model.get('name'));
      return repo_model.get('is_starred');
    },
    match_contribution: function(contribution_model) {
      return true;
    },
    persist: function() {
      console.debug('FilterModel.persist()');
      localStorage.setItem('filterModel', JSON.stringify(this.toJSON()));
    },
    restore: function() {
      console.debug('FilterModel.restore()');
      var string_data = localStorage.getItem('filterModel');
      if (string_data) {
        var data = JSON.parse(string_data);
        this.set(data);
        return true;
      }
      return false;
    },
  });

  namespace.FilterView = Backbone.View.extend({
    tagName: 'div',
    className: 'filter',
    template: _.template($('#filter-template').html()),
    events: {
      'change input': 'change_filter',
    },
    initialize: function() {
      console.debug('FilterView.initialize()');
      this.$el.html(this.template(this.model.toJSON()));
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change', this.persist);
      this.listenTo(this.model, 'destroy', this.remove);
    },
    render: function() {
      console.debug('FilterView.render()');
      this.$('.filter').html(this.template(this.model.toJSON()));
      return this;
    },
    persist: function() {
      this.model.persist();
    },
    change_filter: function(event) {
      var name  = event.currentTarget.name;
      if (name == 'filter_starred') {
        var checked = event.currentTarget.checked;
        console.debug('FilterView.change_filter() starred: ' + checked);
        this.model.set({starred: checked});
      } else {
        console.warn('FilterView.change_filter() unknown filter name: ' + name);
      }
    },
  });

  /*
   * A summary model has the following attributes:
   * - contribution_summary
   * - matched_contribution_summary
   */
  namespace.SummaryModel = Backbone.Model.extend({
    defaults: {
      'contribution_summary': new namespace.ContributionSummary(),
      'matched_contribution_summary': new namespace.ContributionSummary(),
    },
  });

  namespace.SummaryView = Backbone.View.extend({
    tagName: 'div',
    className: 'summary',
    template: _.template($('#summary-template').html()),
    initialize: function() {
      console.debug('SummaryView.initialize()');
      this.group_collections = [];
      this.$el.html(this.template(this.model.toJSON()));
      this.listenTo(this.model, 'change', this.render);
    },
    render: function() {
      console.debug('SummaryView.render()');
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    },
    add_group_collection: function(group_collection) {
      console.debug('SummaryView.add_group_collection()');
      this.group_collections.push(group_collection);
      this.listenTo(group_collection, 'add', this.addOne);
      this.listenTo(group_collection, 'reset', this.update);
      this.listenTo(group_collection, 'remove', this.removeOne);
    },
    addOne: function(group_model) {
      console.debug('SummaryView.addOne()');
      this.listenTo(group_model, 'change:contribution_summary', this.update);
      return this;
    },
    removeOne: function(model, collection, options) {
      console.debug('SummaryView.removeOne()');
      this.update();
      return this;
    },
    update: function() {
      console.debug('SummaryView.update()');
      var summary = new namespace.ContributionSummary();
      _(this.group_collections).each(function(group_collection) {
        console.debug('group_collection = ' + group_collection + ' ' + group_collection.length);
        group_collection.each(function(group_model, index) {
          console.debug('group_model = ' + group_model);
          summary.addContributionSummary(group_model.get('contribution_summary'));
        });
      });
      summary.updateLoginOrder();
      console.debug('summary: ' + summary.summary.additions + summary.summary.deletions + summary.summary.commits);
      this.model.set({'contribution_summary': summary});
      //this.update_matched_contribution_summary();
    },
  });


  namespace.StatisticsDashboardView = Backbone.View.extend({
    tagName: 'div',
    className: 'statistics_dashboard',
    template: _.template($('#statistics-dashboard').html()),
    initialize: function() {
      console.debug('StatisticsDashboardView.initialize()');
      this.$el.html(this.template());

      this._summary_model = new namespace.SummaryModel();
      this._summary_view = new namespace.SummaryView({model: this._summary_model});
      this.$('.provider_status').append(this._summary_view.render().el);

      this._filter_model = new namespace.FilterModel();
      this._filter_model.restore();
      this._filter_view = new namespace.FilterView({model: this._filter_model});
      this.$('.provider_status').append(this._filter_view.render().el);
      this._providers = [];
    },
    render: function() {
      console.debug('StatisticsDashboardView.render()');
      return this;
    },
    get_filter_model: function() {
      console.debug('StatisticsDashboardView.get_filter_model()');
      return this._filter_model;
    },
    add_provider: function(provider) {
      console.log('StatisticsDashboardView.add_provider() ' + provider.get_name());
      this.$('.provider_status').append(provider.get_status_view().render().el);
      this.$('.provider_login').append(provider.get_login_view().render().el);
      this.$('.provider_dashboard').append(provider.get_dashboard_view().render().el);
      this._summary_view.add_group_collection(provider.get_dashboard_view().group_collection);
      this._providers.push(provider);
    },
  });

})(window.statistics_dashboard = window.statistics_dashboard || {});
