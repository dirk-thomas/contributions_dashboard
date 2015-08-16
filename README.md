Statistics Dashboard
====================

The statistics dashboard is a client side web application which lets you log in to GitHub showing statistics across all organization units and repositories.

It does not require to run a web server since the HTML page uses JS to talk directly to the GitHub API.

How to run it
-------------

You can either use it directly from the GitHub page: http://dirk-thomas.github.io/statistics_dashboard/

Or you can clone the repository and open the index.html file using a file:// url.

How to automate the login
-------------------------

You can automate the login by adding your credentials (either an OAuth token or the username and password) to the config.js file.

You should only do that in a local workspace and never commit your credentials to a publically readable repository.

What scopes should the OAuth token grant access to?
---------------------------------------------------

The OAuth token should grant the scope `repo` in order to list all repositories of the user as well as related organization units.
