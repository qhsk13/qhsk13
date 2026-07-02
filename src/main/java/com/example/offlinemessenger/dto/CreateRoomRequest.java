package com.example.offlinemessenger.dto;

import com.example.offlinemessenger.entity.RoomType;
import java.util.List;

public class CreateRoomRequest {
    private String name;
    private RoomType type;
    private List<String> members;

    public String getName() { return name; }
    public RoomType getType() { return type; }
    public List<String> getMembers() { return members; }
    public void setName(String name) { this.name = name; }
    public void setType(RoomType type) { this.type = type; }
    public void setMembers(List<String> members) { this.members = members; }
}
