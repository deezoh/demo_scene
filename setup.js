
window.AVATAR_CONFIG = {
  lang: 'en-US',
  bg: 'studio',
  speechCommands: true,
  liveMusic: false,
  commands: [
    { action: 'mode:present',   words: ['let me present', 'back to the board', 'presentation mode'] },
    { action: 'mode:sit',       words: ['take a seat', 'sit down', 'any questions', 'open the floor'] },
    { action: 'mode:celebrate', words: ['we won', 'we did it', 'congratulations', 'celebrate', 'champions'] },
    { action: 'board:next',     words: ['next point', 'next slide', 'as you can see', 'moving on', 'next step'] },
    { action: 'board:back',     words: ['previous point', 'previous slide', 'go back'] }
  ]
};
