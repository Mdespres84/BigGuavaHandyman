/*
  Site settings. Edit these three lines, then commit.

  WEB3FORMS_KEY: free key from https://web3forms.com (enter the email that should receive requests).
                 This key is designed to be public. Lock it to your domain in the Web3Forms dashboard.
  PHONE:         the business number customers text photos to.
  PHOTO_UPLOADS: leave false on the free Web3Forms plan (file attachments are a paid feature).
  OPS_ENDPOINT:  the ops sheet's web-app URL (Deploy → Web app). Every request sent from the site is
                 also logged on the sheet's Estimates tab. Leave "" to send by email only.
*/
window.BG_CONFIG = Object.freeze({
  WEB3FORMS_KEY: "db28e665-dac2-475c-b6b6-93728d8a7e57",
  PHONE: "(813) 555-0100",
  PHOTO_UPLOADS: false,
  OPS_ENDPOINT: "https://script.google.com/macros/s/AKfycbwGtFFTciMy2JK0Iw9mQ_2jeaeUjtgkuDwcxwtB7fulcB_QCuT3UqMq59vc-bxosa5miA/exec"
});
