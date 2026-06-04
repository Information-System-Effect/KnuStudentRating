window.APP_CONFIG = {
  GATEWAY_URL: "http://localhost:8080/gateway/message",

  // ВАЖЛИВО:
  // значення ролей тут мають збігатися з ROLES у utils/constants на бекенді
  ROLE_MAP: {
    U: "STUDENT",
    L: "TEACHER",
    A: "ADMIN"
  }
};