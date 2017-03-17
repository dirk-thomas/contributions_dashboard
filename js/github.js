/**
 * JavaScript interface to GitHub API v3.
 * https://developer.github.com/v3/
 *
 * Copyright (c) 2013-2015, Dirk Thomas
 * Distributed under the BSD 2-Clause license
 * https://github.com/dirk-thomas/contributions_dashboard/
 **/

(function(namespace) {

  namespace.GitHub = function(options) {

    // All API access is over HTTPS, and accessed from the api.github.com domain.
    // https://developer.github.com/v3/#schema
    var github_api_url = 'https://api.github.com';

    this.debug = options.debug;

    // Get the authenticated user
    // https://developer.github.com/v3/users/#get-the-authenticated-user
    this.user = function(cb) {
      _get('/user', function(err, res) {
        cb(err, res);
      });
    };

    // List repositories for the authenticated user
    // https://developer.github.com/v3/repos/#list-your-repositories
    this.userRepos = function(cb) {
      _get_all('/user/repos', function(err, res) {
        cb(err, res);
      });
    };

    // List public and private organizations for the authenticated user
    // https://developer.github.com/v3/orgs/#list-user-organizations
    this.orgs = function(cb) {
      _get_all('/user/orgs', function(err, res) {
        cb(err, res);
      });
    };

    // List repositories for the specified org
    // https://developer.github.com/v3/repos/#list-organization-repositories
    this.orgRepos = function(org, cb) {
      _get_all('/orgs/' + org + '/repos', function(err, res) {
        cb(err, res);
      });
    };

    // List repositories starred by the authentiticated user
    // https://developer.github.com/v3/activity/starring/#list-repositories-being-starred
    this.starredRepos = function(cb) {
      _get_all('/user/starred', function(err, res) {
        cb(err, res);
      });
    };

    // List contributors statistics for the specified repository
    // https://developer.github.com/v3/repos/statistics/#contributors
    this.contributorsStats = function(full_name, cb) {
      _get_all('/repos/' + full_name + '/stats/contributors', function(err, res) {
        cb(err, res);
      });
    };

    // Access API and combine paginated results automatically
    // https://developer.github.com/v3/#pagination
    function _get_all(path, cb) {
      // use local var since multiple requests might run concurrently
      var result = [];
      var recursive_callback = function(err, res, next_path) {
        if (err) {
          cb(err);
        } else {
          result.push.apply(result, res);
          if (next_path) {
            _get(next_path, recursive_callback);
          } else {
            cb(null, result);
          }
        }
      };
      _get(path, recursive_callback);
    }

    var self = this;
    // Access API and parse the JSON encoded response
    // https://developer.github.com/v3/#schema
    function _get(path, cb) {
      // use local var since multiple requests might run concurrently
      var url = github_api_url + path;
      // append current timestamp to prevent cached result
      url += (url.indexOf('?') === -1 ? '?' : '&') + (new Date()).getTime();
      if (self.debug) {
        console.log('GitHub._get() url: ' + url);
      }

      var xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      //xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

      // require user agent
      // https://developer.github.com/v3/#user-agent-required
      //xhr.setRequestHeader('User-Agent', 'https://github.com/dirk-thomas/contributions_dashboard/');

      xhr.onreadystatechange = function () {
        if (this.readyState == 2) {
          if (self.debug) {
            // extract and output rate limit
            var rate_limit = this.getResponseHeader('X-RateLimit-Limit');
            var rate_limit_remaining = this.getResponseHeader('X-RateLimit-Remaining');
            console.log('GitHub._get() rate limit: ' + rate_limit_remaining + ' of ' + rate_limit + ' remaining');
          }
          // extract next link if available
          var link = this.getResponseHeader('Link');
          if (link) {
            var next_link = link.replace(/.*<(.+)>; rel="next".*/, '$1');
            if (next_link.substr(0, github_api_url.length) === github_api_url) {
              this._next_link = next_link.substr(github_api_url.length);
            }
          }
        } else if (this.readyState == 4) {
          if (this.status >= 200 && this.status != 202 && this.status < 300 || this.status === 304) {
            var res = this.responseText ? JSON.parse(this.responseText) : true;
            if (self.debug) {
              console.log('GitHub._get() url: ' + url + ', result keys: ' + Object.keys(res));
            }
            cb(null, res, this._next_link);
          } else {
            if (self.debug) {
              console.log('GitHub._get() url: ' + url + ', status: ' + this.status + ', response: ' + this.responseText);
            }
            cb(this);
          }
        }
      };

      // Authentication
      // https://developer.github.com/v3/#authentication
      if (options.auth == 'oauth') {
        if (!options.token) {
          cb(new Error('Auth type "' + options.auth + '" requires "token" argument'));
        }
        // OAuth2 Token (sent in a header)
        xhr.setRequestHeader('Authorization', 'token '+ options.token);
      } else if (options.auth == 'basic') {
        if (!options.username || !options.password) {
          cb(new Error('Auth type "' + options.auth + '" requires "username" and "password" arguments'));
        }
        // Basic Authentication
        xhr.setRequestHeader('Authorization', 'Basic ' + base64_encode(options.username + ':' + options.password));
      } else {
        cb(new Error('Unknown auth type "' + options.auth + '"'));
      }

      xhr.send();
    }

  };

})(window.github = window.github || {});
