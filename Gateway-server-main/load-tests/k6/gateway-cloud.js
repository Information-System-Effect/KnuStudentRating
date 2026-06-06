import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "2m", target: 50 },
    { duration: "30s", target: 0 }
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const res = http.post(
    `${BASE_URL}/gateway/message`,
    "L1#U2#PATCH#LANG_JAVA#+10",
    {
      headers: {
        "Content-Type": "text/plain",
        "x-user-role": "TEACHER",
        "x-user-code": "L1",
        "x-request-id": `k6-${__VU}-${__ITER}`
      }
    }
  );

  check(res, {
    "status is 200": (r) => r.status === 200
  });
}
