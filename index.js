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

// we need CONSUMERKEY and CONSUMERSECRET to operate successfully
if(process.env.CONSUMERKEY && process.env.CONSUMERSECRET) { 
  // instantiate partyflock
  var partyflockInstance = new Partyflock(process.env.CONSUMERKEY, process.env.CONSUMERSECRET, endpoint, debug);

  // router: fetch agenda for today
  router.get('/', function *() {
    var result = yield partyflockInstance.date.lookup(moment().format('YYYYMMDD')).then(function(res) {
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
