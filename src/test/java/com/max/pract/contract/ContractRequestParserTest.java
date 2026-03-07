package com.max.pract.contract;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContractRequestParserTest {

    private final ContractRequestParser parser = new ContractRequestParser();

    @Test
    void parsesDeleteWithoutNumericValue() {
        ContractRequest request = parser.parse("U100#U100#DELETE#LANG_JAVA#\"\"");

        assertEquals(ApiAction.DELETE, request.action());
        assertEquals(1, request.changes().size());
        assertEquals("LANG_JAVA", request.changes().get(0).categoryCode());
        assertEquals(0f, request.changes().get(0).value());
    }

    @Test
    void parsesCanonicalSetAndAddForUpdate() {
        ContractRequest request = parser.parse("U100#U100#PUT#LANG_JAVA#SET:60#OS_LINUX#ADD:-5");

        assertEquals(ApiAction.PUT, request.action());
        assertEquals(ChangeMode.SET, request.changes().get(0).mode());
        assertEquals(60f, request.changes().get(0).value());
        assertEquals(ChangeMode.ADD, request.changes().get(1).mode());
        assertEquals(-5f, request.changes().get(1).value());
    }

    @Test
    void rejectsOddTail() {
        assertThrows(
                IllegalArgumentException.class,
                () -> parser.parse("U100#U100#PUT#LANG_JAVA")
        );
    }

    @Test
    void parsesTeacherUserCodes() {
        ContractRequest request = parser.parse("T42#U100#GET#STUDENTS#\"page=1;limit=10\"");
        assertEquals("T42", request.senderId());
    }
}
