var koa = require('koa'),
    app = koa(),
    router = require('koa-router')(),
    json = require('koa-json'),
    moment = require('moment'),
    Partyflock = require('partyflock');

// extra environment vars
var debug = false,
    endpoint = 'partyflock.nl';
if(process.env.DEBUG) {
  debug = !!process.env.DEBUG;
}
if(process.env.ENDPOINT) {
  endpoint = process.env.ENDPOINT;
}

function compare(a,b) {
  if (parseFloat(a.time_start) < parseFloat(b.time_start)) {
    return -1;
  }
  else if (parseFloat(a.time_start) > parseFloat(b.time_start)) {
    return 1;
  }
  else {
    return 0;
  }
}

function sortLineup(lineup) {
  return lineup.sort(compare);
}

// we need CONSUMERKEY and CONSUMERSECRET to operate successfully
if(process.env.CONSUMERKEY && process.env.CONSUMERSECRET) { 
  // instantiate partyflock
  var partyflockInstance = new Partyflock(process.env.CONSUMERKEY, process.env.CONSUMERSECRET, endpoint, debug);

  // router: fetch agenda for today
  router.get('/', function *() {
    var headers = {
      'Pf-ResultWish': 'date(agenda(party(name,stamp,location(name),visitors(user(id)))))'
    };
    if(this.request && this.request.query) {
      if('latitude' in this.request.query && this.request.query.latitude) {
        headers['Pf-Latitude'] = parseFloat(this.request.query.latitude, 10);
      }
      if('longitude' in this.request.query && this.request.query.longitude) {
        headers['Pf-Longitude'] = parseFloat(this.request.query.longitude, 10);
      }
      if('radius' in this.request.query && this.request.query.radius) {
        headers['Pf-Radius'] = parseInt(this.request.query.radius, 10);
      }

      console.log('params', this.request.query, headers);
    }
    
    var result = yield partyflockInstance.date.lookup(moment().format('YYYYMMDD'), headers).then(function(res) {
      if(!res) {
        return Promise.reject('Agenda lookup failed!');
      }
      return res.date.agenda.party;
    }).map(function(party) {
      var visitors = 0,
          location = '',
          name = '',
          id = '';
      try { location = party.location.name; }
      catch(e) {}
      try { visitors = party.visitors.user.length; }
      catch(e) {}
      try { name = party.name; }
      catch(e) {}
      try { id = party.id; }
      catch(e) {}

      return {
        'id': id,
        'name': name,
        'location': location,
        'visitors': visitors
      };
    }).then(function(res) {
      return {'success': true, 'data': res, 'message': ''};
    }).catch(function(err) {
      return {'success': false, 'message': err};
    });
    this.body = result;
  });

  // router: fetch for individual party
  router.get('/party/:id', function *() {
    var id = parseInt(this.params.id, 10);
    var headers = {
      'Pf-ResultWish': 'party(name,genre(name),area(name,lineup(id,time_start,time_end,artist(name),type)))'
    };
    var result = yield partyflockInstance.party.lookup(id, headers).then(function(res) {
      if(!res) {
        return Promise.reject('Party lookup failed!');
      }

      if('party' in res && 
          res.party && 'area' in res.party &&
          res.party.area) {
        if(res.party.area instanceof Array) {
          res.party.area.forEach(function(area, i) {
            sortLineup(area.lineup, function(lineup) {
              res.party.area[i].lineup = lineup;
            });
          });
        }
        else {
          sortLineup(res.party.area.lineup, function(lineup) {
            res.party.area.lineup = lineup;
          });
        }
      }

      return {'success': true, 'data': res, 'message': ''};
    }).catch(function(err) {
      return {'success': false, 'message': err};
    });
    this.body = result;
  });

  // middlewares
  app
    .use(router.routes())
    .use(router.allowedMethods())
    .use(json());

  app.listen(process.env.PORT || 3000);
}
else {
  console.error('Process variables CONSUMERKEY and CONSUMERSECRET not set, exiting!');
  process.exit(1);
}
