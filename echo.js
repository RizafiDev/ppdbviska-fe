import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const echo = new Echo({
  broadcaster: 'pusher',
  key: '96e62396476ecd8fe260',
  cluster: 'ap1',
  forceTLS: true,
});

export default echo;
